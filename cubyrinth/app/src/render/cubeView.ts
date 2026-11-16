import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TUNING, type BallId } from '../config/tuning';
import type { Cube } from '../maze/generator';
import { NORMALS, U_AXES, V_AXES, cellCol, cellFace, cellRow, type Vec3 } from '../maze/topology';
import type { Mat3 } from '../physics/orientation';
import type { BallSim } from '../physics/sim';
import { buildFaceWalls } from '../physics/walls';
import { MATERIALS, type MaterialId } from './materials';

/**
 * Draws the cube (§8): floors, merged wall boxes, rim and gate openings,
 * holes, start marker and finish cup, the ball, and a fading trail. The cube
 * is drawn tilted by t × 15° so what the player sees matches what the ball
 * feels. Drawing only – reads the simulation, never changes it.
 */
export class CubeView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  private tiltGroup = new THREE.Group();
  private cubeGroup = new THREE.Group();
  private ball: THREE.Mesh;
  private ballQ = new THREE.Quaternion();
  private trail: THREE.InstancedMesh;
  private trailPts: THREE.Vector3[] = [];
  private gateMats: THREE.MeshStandardMaterial[] = [];
  private finishGlow!: THREE.Mesh;
  private time = 0;
  private cube: Cube | null = null;
  private n = 3;
  private disposables: { dispose(): void }[] = [];
  private qFrom = new THREE.Quaternion();
  private qTo = new THREE.Quaternion();
  private lastFace = -1;
  reducedMotion = false;
  showTrail = true;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // One soft light from above with short wall shadows.
    this.scene.add(new THREE.HemisphereLight(0xd8ccff, 0x1b043b, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-3, 12, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.sun = sun;

    this.tiltGroup.add(this.cubeGroup);
    this.scene.add(this.tiltGroup);

    const ballGeo = new THREE.SphereGeometry(TUNING.BALL_RADIUS, 32, 24);
    this.ball = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.22, map: ballTexture() }));
    this.ball.castShadow = true;
    this.cubeGroup.add(this.ball);

    this.trail = new THREE.InstancedMesh(new THREE.CircleGeometry(0.07, 12), new THREE.MeshBasicMaterial({ color: 0x06ffff, transparent: true, opacity: 0.55, depthWrite: false }), TUNING.TRAIL_POINTS);
    this.trail.count = 0;
    this.trail.frustumCulled = false;
    this.cubeGroup.add(this.trail);
  }

  private sun: THREE.DirectionalLight;

  setBall(id: BallId): void {
    const m = this.ball.material as THREE.MeshStandardMaterial;
    m.color.set(id === 'bronze' ? 0xd08a4e : id === 'silver' ? 0xe6e8f0 : 0xffc93c);
    m.roughness = id === 'silver' ? 0.15 : 0.25;
  }

  /** Builds the cube mesh from the generated data. */
  build(cube: Cube, material: MaterialId): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    for (const child of [...this.cubeGroup.children]) if (child !== this.ball && child !== this.trail) this.cubeGroup.remove(child);
    this.gateMats = [];
    this.cube = cube;
    const n = cube.n;
    this.n = n;
    const mat = MATERIALS[material];

    // Core with a subtle checker on each face.
    const tex = checkerTexture(n, mat.floor, mat.floorAlt);
    const coreMat = new THREE.MeshStandardMaterial({ map: tex, roughness: mat.floorRoughness, metalness: 0.05 });
    const core = new THREE.Mesh(new THREE.BoxGeometry(n, n, n), coreMat);
    core.receiveShadow = true;
    this.cubeGroup.add(core);
    this.track(core.geometry, coreMat, tex);

    // Walls: one merged mesh.
    const H = TUNING.WALL_HEIGHT;
    const w = TUNING.WALL_THICKNESS;
    const geos: THREE.BufferGeometry[] = [];
    for (let f = 0; f < 6; f++) {
      const walls = buildFaceWalls(cube, f);
      for (const s of walls.segments) {
        const len = Math.hypot(s.bx - s.ax, s.by - s.ay) + w;
        const g = new THREE.BoxGeometry(len, H, w);
        const mx = (s.ax + s.bx) / 2;
        const my = (s.ay + s.by) / 2;
        const alongU = s.ay === s.by;
        g.applyMatrix4(faceMatrix(f, n, mx, my, H / 2, alongU));
        geos.push(g);
      }
    }
    const wallMat = new THREE.MeshStandardMaterial({ color: mat.wall, roughness: 0.45, metalness: 0.1, emissive: mat.wallEmissive, emissiveIntensity: mat.wallEmissiveIntensity });
    const wallsMesh = new THREE.Mesh(mergeGeometries(geos), wallMat);
    geos.forEach((g) => g.dispose());
    wallsMesh.castShadow = true;
    wallsMesh.receiveShadow = true;
    this.cubeGroup.add(wallsMesh);
    this.track(wallsMesh.geometry, wallMat);

    // Gates glow on both sides.
    const gateGeo = new THREE.BoxGeometry(0.72, 0.03, 0.16);
    this.track(gateGeo);
    for (const g of cube.gates) {
      const m = new THREE.MeshStandardMaterial({ color: 0x06ffff, emissive: 0x06ffff, emissiveIntensity: 1.2 });
      this.gateMats.push(m);
      this.track(m);
      for (const [cell, side] of [
        [g.cellA, g.sideA],
        [g.cellB, g.sideB],
      ]) {
        const f = cellFace(n, cell);
        const cx = cellCol(n, cell) + 0.5 + [0.38, 0, -0.38, 0][side];
        const cy = cellRow(n, cell) + 0.5 + [0, 0.38, 0, -0.38][side];
        const mesh = new THREE.Mesh(gateGeo, m);
        mesh.applyMatrix4(faceMatrix(f, n, cx, cy, 0.016, side === 1 || side === 3));
        this.cubeGroup.add(mesh);
      }
    }

    // Holes.
    const holeGeo = new THREE.CircleGeometry(TUNING.HOLE_RADIUS, 24);
    const holeRim = new THREE.RingGeometry(TUNING.HOLE_RADIUS, TUNING.HOLE_RADIUS + 0.05, 24);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x05010d });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x9259fe, emissive: 0x3b1878 });
    this.track(holeGeo, holeRim, holeMat, rimMat);
    for (const c of cube.holes) {
      const f = cellFace(n, c);
      const hole = new THREE.Mesh(holeGeo, holeMat);
      hole.applyMatrix4(flatMatrix(f, n, cellCol(n, c) + 0.5, cellRow(n, c) + 0.5, 0.006));
      const ring = new THREE.Mesh(holeRim, rimMat);
      ring.applyMatrix4(flatMatrix(f, n, cellCol(n, c) + 0.5, cellRow(n, c) + 0.5, 0.008));
      this.cubeGroup.add(hole, ring);
    }

    // Start marker and finish cup.
    const sf = cellFace(n, cube.start);
    const start = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.33, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    start.applyMatrix4(flatMatrix(sf, n, cellCol(n, cube.start) + 0.5, cellRow(n, cube.start) + 0.5, 0.006));
    this.cubeGroup.add(start);
    this.track(start.geometry, start.material as THREE.Material);
    const ff = cellFace(n, cube.finish);
    const fx = cellCol(n, cube.finish) + 0.5;
    const fy = cellRow(n, cube.finish) + 0.5;
    const cup = new THREE.Mesh(new THREE.TorusGeometry(TUNING.FINISH_RADIUS + 0.02, 0.05, 12, 32), new THREE.MeshStandardMaterial({ color: 0xffc93c, metalness: 0.9, roughness: 0.25 }));
    cup.applyMatrix4(flatMatrix(ff, n, fx, fy, 0.03));
    cup.castShadow = true;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(TUNING.FINISH_RADIUS, 32), new THREE.MeshStandardMaterial({ color: 0x06ffff, emissive: 0x06ffff, emissiveIntensity: 1 }));
    glow.applyMatrix4(flatMatrix(ff, n, fx, fy, 0.007));
    this.finishGlow = glow;
    this.cubeGroup.add(cup, glow);
    this.track(cup.geometry, cup.material as THREE.Material, glow.geometry, glow.material as THREE.Material);

    // Shadow camera covers the cube.
    const sc = this.sun.shadow.camera;
    sc.left = -n;
    sc.right = n;
    sc.top = n;
    sc.bottom = -n;
    sc.near = 1;
    sc.far = 40;
    sc.updateProjectionMatrix();

    this.trailPts = [];
    this.trail.count = 0;
    this.lastFace = -1;
    this.resize();
  }

  private track(...items: { dispose(): void }[]): void {
    this.disposables.push(...items);
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const hgt = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, hgt, false);
    const aspect = w / hgt;
    this.camera.aspect = aspect;
    const n = this.n;
    // Top face fills the screen width with the adjoining faces just visible.
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hTan = Math.tan(vfov / 2) * aspect;
    const vTan = Math.tan(vfov / 2);
    const widthNeeded = n * 1.5;
    const heightNeeded = n * 1.7;
    const dist = Math.max(widthNeeded / (2 * hTan), heightNeeded / (2 * vTan)) + n / 2;
    const ang = (TUNING.CAMERA_ANGLE_DEG * Math.PI) / 180;
    this.camera.position.set(0, Math.cos(ang) * dist, Math.sin(ang) * dist);
    this.camera.lookAt(0, n / 2, 0);
    // Frame the cube in the upper part of the screen, so the thumb rests below it.
    this.camera.setViewOffset(w, hgt, 0, hgt * 0.1, w, hgt);
    this.camera.updateProjectionMatrix();
  }

  /** Draws one frame. `alpha` interpolates between the last two ticks; `settle` (0..1) sinks the ball into the finish cup. */
  render(sim: BallSim, alpha: number, dt: number, settle = 0): void {
    this.time += dt;
    const r = TUNING.BALL_RADIUS;

    // Orientation, and the turn.
    let opacity = 1;
    let level = 1;
    if (sim.state === 'TURNING' && sim.turn) {
      const p = sim.turnProgress;
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setQuat(this.qFrom, sim.turn.fromR);
      setQuat(this.qTo, sim.turn.toR);
      if (this.reducedMotion) {
        // A short cross-fade instead of the roll.
        this.cubeGroup.quaternion.copy(p < 0.5 ? this.qFrom : this.qTo);
        opacity = p < 0.5 ? 1 - 2 * p : 2 * p - 1;
      } else this.cubeGroup.quaternion.slerpQuaternions(this.qFrom, this.qTo, e);
      // The ball rides a quarter circle round the edge.
      const t = sim.turn;
      const phi = (this.reducedMotion ? (p < 0.5 ? 0 : 1) : e) * (Math.PI / 2);
      // The tilt is reset to level when the turn ends (§7.7): ease it out, so the cube does not snap.
      level = 1 - e;
      const pos = add3(t.edge, add3(scale3(t.N, r * Math.cos(phi)), scale3(t.d, r * Math.sin(phi))));
      this.ball.position.set(pos[0], pos[1], pos[2]);
      this.trail.count = 0;
      this.trailPts = [];
    } else {
      setQuat(this.cubeGroup.quaternion, sim.R);
      const x = sim.prev.x + (sim.p.x - sim.prev.x) * alpha;
      const y = sim.prev.y + (sim.p.y - sim.prev.y) * alpha;
      const c = sim.toCube(sim.face, x, y);
      const N = NORMALS[sim.face];
      let lift = r;
      let s = 1;
      if (sim.state === 'FALLING') {
        const fallTicks = TUNING.FALL_SECONDS * TUNING.TICK_HZ;
        const k = Math.min(1, sim.fallTick / fallTicks);
        s = 1 - k;
        lift = r - k * r * 2;
      }
      this.ball.scale.setScalar(Math.max(0.001, s));
      this.ball.position.set(c[0] + N[0] * lift, c[1] + N[1] * lift, c[2] + N[2] * lift);

      // Spin: angle = distance ÷ r about N × direction.
      const u = U_AXES[sim.face];
      const v = V_AXES[sim.face];
      const vel: Vec3 = [sim.v.x * u[0] + sim.v.y * v[0], sim.v.x * u[1] + sim.v.y * v[1], sim.v.x * u[2] + sim.v.y * v[2]];
      const sp = Math.hypot(vel[0], vel[1], vel[2]);
      if (sp > 1e-4 && sim.state === 'ROLLING') {
        const axis = new THREE.Vector3(N[1] * vel[2] - N[2] * vel[1], N[2] * vel[0] - N[0] * vel[2], N[0] * vel[1] - N[1] * vel[0]).normalize();
        const dq = new THREE.Quaternion().setFromAxisAngle(axis, (sp * dt) / r);
        this.ballQ.premultiply(dq);
        this.ball.quaternion.copy(this.ballQ);
      }

      // Trail on the current face.
      if (sim.face !== this.lastFace) {
        this.trailPts = [];
        this.lastFace = sim.face;
      }
      if (this.showTrail && sim.state === 'ROLLING' && sp > 0.3) {
        const tp = new THREE.Vector3(c[0] + N[0] * 0.004, c[1] + N[1] * 0.004, c[2] + N[2] * 0.004);
        const last = this.trailPts[this.trailPts.length - 1];
        if (!last || last.distanceTo(tp) > 0.12) {
          this.trailPts.push(tp);
          if (this.trailPts.length > TUNING.TRAIL_POINTS) this.trailPts.shift();
        }
      }
      this.updateTrail(sim.face);
    }

    // Tilt: the cube leans by t × 15°.
    const tilt = (TUNING.CUBE_TILT_DEG * Math.PI) / 180;
    this.tiltGroup.rotation.set(sim.t.y * tilt * level, 0, -sim.t.x * tilt * level);

    // Gates glow; the finish pulses.
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 3);
    for (const m of this.gateMats) m.emissiveIntensity = 0.8 + 0.5 * pulse;
    (this.finishGlow.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + 0.8 * pulse;
    this.finishGlow.scale.setScalar(0.85 + 0.15 * pulse);

    if (settle > 0) this.settle(settle);
    this.canvas.style.opacity = String(opacity);
    this.renderer.render(this.scene, this.camera);
  }

  private updateTrail(face: number): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const N = NORMALS[face];
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(N[0], N[1], N[2]));
    const count = this.trailPts.length;
    for (let i = 0; i < count; i++) {
      const s = (i + 1) / count;
      m.compose(this.trailPts[i], q, new THREE.Vector3(s, s, s));
      this.trail.setMatrixAt(i, m);
    }
    this.trail.count = this.showTrail ? count : 0;
    this.trail.instanceMatrix.needsUpdate = true;
  }

  /** Settles the ball into the finish cup (after FINISHED). */
  private settle(progress: number): void {
    if (!this.cube) return;
    const n = this.n;
    const f = this.cube.finish;
    const face = cellFace(n, f);
    const c = cubePoint(face, n, cellCol(n, f) + 0.5, cellRow(n, f) + 0.5, TUNING.BALL_RADIUS - 0.12 * progress);
    this.ball.position.lerp(new THREE.Vector3(c[0], c[1], c[2]), Math.min(1, progress * 1.5));
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function scale3(a: Vec3, k: number): Vec3 {
  return [a[0] * k, a[1] * k, a[2] * k];
}

function setQuat(q: THREE.Quaternion, R: Mat3): void {
  const m = new THREE.Matrix4().set(R[0], R[1], R[2], 0, R[3], R[4], R[5], 0, R[6], R[7], R[8], 0, 0, 0, 0, 1);
  q.setFromRotationMatrix(m);
}

/** Cube-coordinate point on a face at height h above the floor. */
function cubePoint(f: number, n: number, x: number, y: number, h: number): Vec3 {
  const N = NORMALS[f];
  const u = U_AXES[f];
  const v = V_AXES[f];
  const a = x - n / 2;
  const b = y - n / 2;
  const k = n / 2 + h;
  return [N[0] * k + u[0] * a + v[0] * b, N[1] * k + u[1] * a + v[1] * b, N[2] * k + u[2] * a + v[2] * b];
}

/** Places a box modelled with length on X, height on Y, width on Z onto a face. */
function faceMatrix(f: number, n: number, x: number, y: number, h: number, alongU: boolean): THREE.Matrix4 {
  const N = NORMALS[f];
  const u = U_AXES[f];
  const v = V_AXES[f];
  // Right-handed basis (determinant +1) so the box's faces keep their winding.
  const along = alongU ? u : v;
  const across: Vec3 = alongU ? [-v[0], -v[1], -v[2]] : u;
  const p = cubePoint(f, n, x, y, h);
  return new THREE.Matrix4().set(along[0], N[0], across[0], p[0], along[1], N[1], across[1], p[1], along[2], N[2], across[2], p[2], 0, 0, 0, 1);
}

/** Places a flat XY-plane shape (normal +Z) onto a face. */
function flatMatrix(f: number, n: number, x: number, y: number, h: number): THREE.Matrix4 {
  const N = NORMALS[f];
  const u = U_AXES[f];
  const v = V_AXES[f];
  const p = cubePoint(f, n, x, y, h);
  return new THREE.Matrix4().set(u[0], v[0], N[0], p[0], u[1], v[1], N[1], p[1], u[2], v[2], N[2], p[2], 0, 0, 0, 1);
}

function checkerTexture(n: number, a: string, b: string): THREE.CanvasTexture {
  const px = 64;
  const c = document.createElement('canvas');
  c.width = c.height = n * px;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 ? a : b;
      ctx.fillRect(i * px, j * px, px, px);
    }
  // Soft vignette towards the rim.
  const g = ctx.createRadialGradient(c.width / 2, c.height / 2, c.width * 0.2, c.width / 2, c.height / 2, c.width * 0.75);
  g.addColorStop(0, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function ballTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 28, 128, 8);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(16 + i * 32, 14, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
