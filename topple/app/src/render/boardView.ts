import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TUNING } from '../config/tuning';
import type { ChainResult, FallEvent } from '../chain/chain';
import type { PieceKind, Placement, Puzzle } from '../chain/model';
import { dominoStyle, tableStyle } from './styles';

/**
 * Draws the board (§10): table, dominoes, gaps, ramps and balls, and plays
 * a chain result as animation. The rules are worked out by chain/ – the fall
 * here is only drawing, driven by the event times.
 */

const D2R = Math.PI / 180;
const T = TUNING;

interface DominoObj {
  slot: number;
  root: THREE.Group;
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  kind: PieceKind;
  height: number;
  angle: number;
}

type Phase = 'plan' | 'topple' | 'hold' | 'reset' | 'won';

function seeded(i: number): number {
  let x = Math.imul(i + 1, 2654435761) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 1597334677) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export class BoardView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  private world = new THREE.Group();
  private puzzle!: Puzzle;
  private dominoes = new Map<number, DominoObj>();
  private gapMarks = new Map<number, { fill: THREE.Mesh; line: THREE.LineSegments }>();
  private hintMark: THREE.Object3D | null = null;
  private stopRings: THREE.Mesh[] = [];
  private balls: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; launch: number; travel: number }[] = [];
  private ghost: THREE.Group | null = null;
  private arrow!: THREE.Mesh;
  private flagCloth!: THREE.Mesh;
  private confetti: THREE.InstancedMesh | null = null;
  private confettiState: { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; w: THREE.Vector3 }[] = [];
  private disposables: { dispose(): void }[] = [];
  private raf = 0;
  private last = 0;
  private time = 0;

  private phase: Phase = 'plan';
  private result: ChainResult | null = null;
  private chainT = 0;
  private phaseT = 0;
  private fallPlan = new Map<number, { start: number; rest: number; dir: number; dur: number }>();
  private nextEvent = 0;
  private resetFrom = new Map<number, number>();
  onFall: ((e: FallEvent) => void) | null = null;
  onBall: ((ramp: number, phase: 'launch' | 'strike') => void) | null = null;
  onChainEnd: ((r: ChainResult) => void) | null = null;
  onResetDone: (() => void) | null = null;
  reducedMotion = false;
  startPulse = false;

  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private planPos = new THREE.Vector3();
  private planLook = new THREE.Vector3();
  private planDist = 20;
  private raycaster = new THREE.Raycaster();
  private tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private bottomPad = 0;
  private topPad = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.add(new THREE.HemisphereLight(0xf0e8ff, 0x2a0b5a, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(-4, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -9;
    sc.right = 9;
    sc.top = 9;
    sc.bottom = -9;
    sc.far = 40;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    this.scene.add(this.world);
  }

  /** Board coordinates (x right, y up the board) → world (y up from the table). */
  static world(x: number, y: number, h = 0): THREE.Vector3 {
    return new THREE.Vector3(x - T.BOARD_W / 2, h, T.BOARD_H / 2 - y);
  }

  load(puzzle: Puzzle, placement: Placement, styleId: string, tableId: string): void {
    this.clear();
    this.puzzle = puzzle;
    const style = dominoStyle(styleId);
    const table = tableStyle(tableId);

    // Table.
    const tex = tableTexture(table.base, table.grain);
    const tableMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
    const top = new THREE.Mesh(new RoundedBoxGeometry(T.BOARD_W + 0.8, 0.4, T.BOARD_H + 0.8, 3, 0.18), tableMat);
    top.position.y = -0.2;
    top.receiveShadow = true;
    this.world.add(top);
    this.track(top.geometry, tableMat, tex);

    // Dominoes.
    const stdGeo = new RoundedBoxGeometry(T.DOMINO_THICK, T.DOMINO_HEIGHT, T.DOMINO_WIDTH, 2, 0.035);
    const tallGeo = new RoundedBoxGeometry(T.DOMINO_THICK, T.TALL_HEIGHT, T.DOMINO_WIDTH, 2, 0.035);
    this.track(stdGeo, tallGeo);
    const mats = new Map<number, THREE.MeshStandardMaterial>();
    const mat = (c: number) => {
      let m = mats.get(c);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ color: c, roughness: style.roughness, metalness: style.metalness, emissive: style.emissive ? c : 0x000000, emissiveIntensity: style.emissive ? 0.35 : 0 });
        mats.set(c, m);
        this.track(m);
      }
      return m;
    };
    this.stdGeo = stdGeo;
    this.tallGeo = tallGeo;
    this.matFor = (slot: number, player: boolean, kind: PieceKind) => (player ? mat(style.player) : kind === 'tall' ? mat(style.tall) : mat(style.colours[Math.floor(slot / 6) % style.colours.length]));

    for (const s of puzzle.slots) {
      if (s.holds !== 'gap') this.addDomino(s.id, s.holds, false);
      else this.addGapMark(s.id);
    }
    this.setPlacement(placement);

    // Ramps.
    puzzle.ramps.forEach((r) => this.addRamp(r.path, r.trigger));

    // Start arrow and flag.
    const arrowGeo = new THREE.ConeGeometry(0.16, 0.34, 18);
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0x06ffff, emissive: 0x06ffff, emissiveIntensity: 0.8 });
    this.arrow = new THREE.Mesh(arrowGeo, arrowMat);
    this.arrow.rotation.x = Math.PI;
    this.world.add(this.arrow);
    this.track(arrowGeo, arrowMat);
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    const clothGeo = new THREE.PlaneGeometry(0.34, 0.22);
    clothGeo.translate(0.17, 0, 0);
    this.flagCloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ color: 0xffc93c, side: THREE.DoubleSide, emissive: 0x6b4a00 }));
    this.flagCloth.position.y = 0.22;
    flagPole.add(this.flagCloth);
    flagPole.position.y = T.DOMINO_HEIGHT / 2 + 0.33;
    const flagDom = this.dominoes.get(puzzle.flag);
    if (flagDom) flagDom.mesh.add(flagPole);
    this.flagPole = flagPole;
    this.track(flagPole.geometry, flagPole.material as THREE.Material, clothGeo, this.flagCloth.material as THREE.Material);

    this.phase = 'plan';
    this.layout();
    this.camPos.copy(this.planPos);
    this.camLook.copy(this.planLook);
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.frame(t));
    }
  }

  private stdGeo!: THREE.BufferGeometry;
  private tallGeo!: THREE.BufferGeometry;
  private matFor!: (slot: number, player: boolean, kind: PieceKind) => THREE.Material;
  private flagPole!: THREE.Mesh;

  private track(...items: { dispose(): void }[]): void {
    this.disposables.push(...items);
  }

  private clear(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.world.clear();
    this.dominoes.clear();
    this.gapMarks.clear();
    this.stopRings = [];
    this.balls = [];
    this.hintMark = null;
    this.ghost = null;
    this.confetti = null;
    this.result = null;
  }

  private addDomino(slot: number, kind: PieceKind, player: boolean): DominoObj {
    const s = this.puzzle.slots[slot];
    const root = new THREE.Group();
    root.position.copy(BoardView.world(s.x, s.y));
    root.rotation.y = s.facing * D2R;
    const pivot = new THREE.Group();
    pivot.position.x = T.DOMINO_THICK / 2;
    root.add(pivot);
    const height = kind === 'tall' ? T.TALL_HEIGHT : T.DOMINO_HEIGHT;
    let material = this.matFor(slot, player, kind);
    if (slot === this.puzzle.start) {
      // Its own material, so the start domino can pulse alone.
      material = (material as THREE.MeshStandardMaterial).clone();
      this.track(material);
    }
    const mesh = new THREE.Mesh(kind === 'tall' ? this.tallGeo : this.stdGeo, material);
    mesh.position.set(-T.DOMINO_THICK / 2, height / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    this.world.add(root);
    const d: DominoObj = { slot, root, pivot, mesh, kind, height, angle: 0 };
    this.dominoes.set(slot, d);
    return d;
  }

  private addGapMark(slot: number): void {
    const s = this.puzzle.slots[slot];
    const g = new THREE.PlaneGeometry(T.DOMINO_THICK + 0.08, T.DOMINO_WIDTH + 0.08);
    g.rotateX(-Math.PI / 2);
    const fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false }));
    const edges = new THREE.EdgesGeometry(g);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    const holder = new THREE.Group();
    holder.position.copy(BoardView.world(s.x, s.y, 0.006));
    holder.rotation.y = s.facing * D2R;
    holder.add(fill, line);
    this.world.add(holder);
    this.gapMarks.set(slot, { fill, line });
    this.track(g, edges, fill.material as THREE.Material, line.material as THREE.Material);
  }

  private addRamp(path: [number, number][], trigger: number): void {
    const a = BoardView.world(path[0][0], path[0][1], 0.95);
    const b = BoardView.world(path[path.length - 1][0], path[path.length - 1][1], 0.3);
    const len = a.distanceTo(b);
    const trackGeo = new THREE.BoxGeometry(0.3, 0.05, len);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0xd0c8df, roughness: 0.4, metalness: 0.3, transparent: true, opacity: 0.85 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.copy(a.clone().add(b).multiplyScalar(0.5));
    track.lookAt(b);
    track.castShadow = true;
    this.world.add(track);
    // Posts.
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6);
    for (const k of [0.1, 0.5, 0.9]) {
      const p = a.clone().lerp(b, k);
      const post = new THREE.Mesh(postGeo, trackMat);
      post.scale.y = p.y;
      post.position.set(p.x, p.y / 2, p.z);
      this.world.add(post);
    }
    const ballGeo = new THREE.SphereGeometry(0.17, 20, 14);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, metalness: 0.8, roughness: 0.25 });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.castShadow = true;
    ball.position.copy(a).add(new THREE.Vector3(0, 0.17, 0));
    this.world.add(ball);
    this.balls.push({ mesh: ball, from: a.clone().add(new THREE.Vector3(0, 0.17, 0)), to: b.clone().add(new THREE.Vector3(0, 0.17, 0)), launch: -1, travel: 0 });
    this.track(trackGeo, trackMat, postGeo, ballGeo, ballMat);
    void trigger;
  }

  /** Shows the player's pieces in their gaps. */
  setPlacement(placement: Placement): void {
    for (const [slot, d] of [...this.dominoes]) {
      if (this.puzzle.slots[slot].holds === 'gap' && !placement.has(slot)) {
        this.world.remove(d.root);
        this.dominoes.delete(slot);
      }
    }
    for (const [slot, kind] of placement) {
      const existing = this.dominoes.get(slot);
      if (existing && existing.kind === kind) continue;
      if (existing) this.world.remove(existing.root);
      const d = this.addDomino(slot, kind, true);
      d.root.scale.setScalar(0.6);
    }
    for (const [slot, g] of this.gapMarks) {
      g.fill.visible = !placement.has(slot);
      g.line.visible = !placement.has(slot);
    }
  }

  /** Brightens a gap's outline while a piece is dragged near it. */
  setGapHighlight(slot: number | null): void {
    for (const [s, g] of this.gapMarks) {
      const on = s === slot;
      (g.fill.material as THREE.MeshBasicMaterial).opacity = on ? 0.35 : 0.08;
      (g.line.material as THREE.LineBasicMaterial).color.set(on ? 0x06ffff : 0xffffff);
      (g.line.material as THREE.LineBasicMaterial).opacity = on ? 1 : 0.55;
    }
  }

  setHint(h: { gap: number; kind: 'essential' | 'decoy' } | null): void {
    if (this.hintMark) this.world.remove(this.hintMark);
    this.hintMark = null;
    if (!h) return;
    const s = this.puzzle.slots[h.gap];
    const g = new THREE.Group();
    g.position.copy(BoardView.world(s.x, s.y, 0.012));
    g.rotation.y = s.facing * D2R;
    if (h.kind === 'essential') {
      const geo = new THREE.RingGeometry(0.34, 0.46, 32);
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.9 }));
      g.add(m);
      this.track(geo, m.material as THREE.Material);
    } else {
      const mat = new THREE.MeshBasicMaterial({ color: 0xff4b6b });
      for (const r of [45, -45]) {
        const geo = new THREE.PlaneGeometry(0.75, 0.09);
        geo.rotateX(-Math.PI / 2);
        geo.rotateY(r * D2R);
        g.add(new THREE.Mesh(geo, mat));
        this.track(geo);
      }
      this.track(mat);
    }
    this.hintMark = g;
    this.world.add(g);
  }

  // ── Dragging ──────────────────────────────────────────────

  showGhost(kind: PieceKind, at: { x: number; y: number } | null, facing = 90): void {
    if (!at) {
      if (this.ghost) this.ghost.visible = false;
      return;
    }
    if (!this.ghost || this.ghost.userData.kind !== kind) {
      if (this.ghost) this.world.remove(this.ghost);
      const style = this.matFor(0, true, kind) as THREE.MeshStandardMaterial;
      const m = style.clone();
      m.transparent = true;
      m.opacity = 0.85;
      const h = kind === 'tall' ? T.TALL_HEIGHT : T.DOMINO_HEIGHT;
      const mesh = new THREE.Mesh(kind === 'tall' ? this.tallGeo : this.stdGeo, m);
      mesh.position.y = h / 2;
      mesh.castShadow = true;
      this.ghost = new THREE.Group();
      this.ghost.add(mesh);
      this.ghost.userData.kind = kind;
      this.world.add(this.ghost);
      this.track(m);
    }
    this.ghost.visible = true;
    this.ghost.position.copy(BoardView.world(at.x, at.y, 0.35));
    this.ghost.rotation.y = facing * D2R;
  }

  /** Screen point → board coordinates on the table. */
  screenToBoard(px: number, py: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((px - rect.left) / rect.width) * 2 - 1, -((py - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.tablePlane, hit)) return null;
    return { x: hit.x + T.BOARD_W / 2, y: T.BOARD_H / 2 - hit.z };
  }

  boardToScreen(x: number, y: number, h = 0): { x: number; y: number } {
    const v = BoardView.world(x, y, h).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  /** The nearest slot to a board point (optionally only gaps), within `max` units. */
  nearestSlot(p: { x: number; y: number }, max: number, filter?: (slot: number) => boolean): number | null {
    let best: number | null = null;
    let bd = max;
    for (const s of this.puzzle.slots) {
      if (filter && !filter(s.id)) continue;
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d <= bd) {
        bd = d;
        best = s.id;
      }
    }
    return best;
  }

  // ── Layout and camera ─────────────────────────────────────

  /** Reserve screen space (px) for the HUD above and the tray below. */
  setPadding(top: number, bottom: number): void {
    this.topPad = top;
    this.bottomPad = bottom;
    this.layout();
  }

  layout(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Fit the whole board from about 55° above the table.
    const el = T.PLAN_CAMERA_DEG * D2R;
    const usableH = Math.max(0.4, (h - this.topPad - this.bottomPad) / h);
    const vfov = this.camera.fov * D2R;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const bw = T.BOARD_W + 0.6;
    const bh = T.BOARD_H + 0.6;
    const projH = bh * Math.sin(el) + 1.2 * Math.cos(el);
    const distH = projH / 2 / Math.tan((vfov * usableH) / 2) + (bh / 2) * Math.cos(el);
    const distW = bw / 2 / Math.tan(hfov / 2) + (bh / 2) * Math.cos(el) * 0.5;
    this.planDist = Math.max(distH, distW);
    this.planLook.set(0, 0, 0.3);
    this.planPos.set(0, Math.sin(el) * this.planDist, Math.cos(el) * this.planDist);
    // Shift the picture so the board sits between the HUD and the tray.
    const shift = (this.bottomPad - this.topPad) / 2;
    this.camera.setViewOffset(w, h, 0, shift, w, h);
    this.camera.updateProjectionMatrix();
  }

  // ── Toppling ──────────────────────────────────────────────

  play(result: ChainResult): void {
    this.result = result;
    this.phase = 'topple';
    this.chainT = -60;
    this.nextEvent = 0;
    this.fallPlan.clear();
    for (const r of this.stopRings) this.world.remove(r);
    this.stopRings = [];
    for (const e of result.fallen) {
      const d = this.dominoes.get(e.slot);
      if (!d) continue;
      const struck = result.fallen.filter((f) => f.by === e.slot && f.cause !== 'ball');
      let rest = 86 + seeded(e.slot) * 3;
      if (struck.length) {
        const s0 = this.puzzle.slots[e.slot];
        const s1 = this.puzzle.slots[struck[0].slot];
        const dist = Math.hypot(s1.x - s0.x, s1.y - s0.y);
        rest = Math.asin(Math.min(0.98, Math.max(0.1, (dist - T.DOMINO_THICK) / d.height))) / D2R + seeded(e.slot + 7) * 4;
      }
      // Slight variation in timing and angle, drawn from the puzzle's seed: the look varies, the result does not.
      this.fallPlan.set(e.slot, { start: e.time + (seeded(e.slot + 13) - 0.5) * 12, rest, dir: 1, dur: d.kind === 'tall' ? T.FALL_MS * 1.3 : T.FALL_MS });
    }
    for (const b of result.balls) {
      const ball = this.balls[b.ramp];
      ball.launch = b.time;
      ball.travel = this.puzzle.ramps[b.ramp].travelMs;
    }
  }

  /** Stand the run back up (0.6 s). */
  reset(): void {
    this.phase = 'reset';
    this.phaseT = 0;
    this.resetFrom.clear();
    for (const [s, d] of this.dominoes) this.resetFrom.set(s, d.angle);
  }

  celebrate(): void {
    this.phase = 'won';
    this.phaseT = 0;
    const n = 140;
    const geo = new THREE.PlaneGeometry(0.12, 0.2);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
    this.confetti = new THREE.InstancedMesh(geo, mat, n);
    const colours = [0x06ffff, 0xffc93c, 0xff4b4b, 0x9259fe, 0x34c759, 0xffffff];
    const flag = this.puzzle.slots[this.puzzle.flag];
    const origin = BoardView.world(flag.x, flag.y, 1);
    this.confettiState = [];
    for (let i = 0; i < n; i++) {
      this.confetti.setColorAt(i, new THREE.Color(colours[i % colours.length]));
      const a = seeded(i) * Math.PI * 2;
      const up = 5 + seeded(i + 50) * 5;
      const out = 1.5 + seeded(i + 99) * 3;
      this.confettiState.push({ p: origin.clone(), v: new THREE.Vector3(Math.cos(a) * out, up, Math.sin(a) * out), r: new THREE.Euler(seeded(i) * 6, seeded(i + 1) * 6, 0), w: new THREE.Vector3(seeded(i + 2) * 10, seeded(i + 3) * 10, 0) });
    }
    this.world.add(this.confetti);
    this.track(geo, mat);
  }

  private frame(now: number): void {
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(50, now - this.last);
    this.last = now;
    this.time += dt;
    if (!this.puzzle) return;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private setAngle(d: DominoObj, deg: number): void {
    d.angle = deg;
    d.pivot.rotation.z = -deg * D2R;
  }

  private update(dt: number): void {
    const r = this.result;
    if (this.phase === 'topple' && r) {
      this.chainT += dt;
      while (this.nextEvent < r.fallen.length && r.fallen[this.nextEvent].time <= this.chainT) this.onFall?.(r.fallen[this.nextEvent++]);
      for (const [slot, plan] of this.fallPlan) {
        const d = this.dominoes.get(slot)!;
        const k = Math.max(0, Math.min(1, (this.chainT - plan.start) / plan.dur));
        this.setAngle(d, plan.rest * k * k);
      }
      for (const [i, b] of this.balls.entries()) {
        if (b.launch < 0) continue;
        const k = Math.max(0, Math.min(1, (this.chainT - b.launch) / b.travel));
        if (k > 0 && !b.mesh.userData.launched) {
          b.mesh.userData.launched = true;
          this.onBall?.(i, 'launch');
        }
        if (k >= 1 && !b.mesh.userData.struck) {
          b.mesh.userData.struck = true;
          this.onBall?.(i, 'strike');
        }
        b.mesh.position.lerpVectors(b.from, b.to, k * k);
        b.mesh.rotation.x += dt * 0.02 * k;
      }
      this.followCamera(dt);
      if (this.chainT > r.duration + T.FALL_MS + 260) {
        this.phase = r.won ? 'won' : 'hold';
        this.phaseT = 0;
        if (!r.won) this.markStops(r);
        this.onChainEnd?.(r);
      }
    } else if (this.phase === 'hold' && r) {
      this.phaseT += dt;
      // The last domino wobbles; the camera lingers on the stopping points.
      const last = this.dominoes.get(r.stops[r.stops.length - 1] ?? -1);
      if (last) {
        const plan = this.fallPlan.get(last.slot);
        if (plan) this.setAngle(last, plan.rest + Math.sin(this.phaseT / 60) * 4 * Math.exp(-this.phaseT / 500));
      }
      for (const ring of this.stopRings) ring.scale.setScalar(1 + 0.12 * Math.sin(this.time / 160));
      this.lingerCamera(r, dt);
    } else if (this.phase === 'reset') {
      this.phaseT += dt;
      const k = Math.min(1, this.phaseT / T.RESET_MS);
      const e = 1 - (1 - k) * (1 - k);
      for (const [s, d] of this.dominoes) this.setAngle(d, (this.resetFrom.get(s) ?? 0) * (1 - e));
      for (const b of this.balls) {
        b.mesh.position.lerpVectors(b.to, b.from, e);
        b.launch = -1;
        b.mesh.userData = {};
      }
      for (const ring of this.stopRings) (ring.material as THREE.MeshBasicMaterial).opacity = 1 - e;
      this.moveCamera(this.planPos, this.planLook, dt, 0.008);
      if (k >= 1) {
        for (const ring of this.stopRings) this.world.remove(ring);
        this.stopRings = [];
        this.phase = 'plan';
        this.result = null;
        this.onResetDone?.();
      }
    } else if (this.phase === 'won') {
      this.phaseT += dt;
      // Pull back to show the whole fallen run; raise the flag; confetti.
      this.moveCamera(this.planPos, this.planLook, dt, 0.004);
      this.flagPole.scale.setScalar(1 + Math.min(1, this.phaseT / 500) * 0.8);
      this.flagCloth.rotation.y = Math.sin(this.time / 140) * 0.4;
      if (this.confetti) {
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const one = new THREE.Vector3(1, 1, 1);
        this.confettiState.forEach((c, i) => {
          c.v.y -= 9.8 * (dt / 1000);
          c.v.multiplyScalar(1 - 0.9 * (dt / 1000));
          c.p.addScaledVector(c.v, dt / 1000);
          if (c.p.y < 0.02) {
            c.p.y = 0.02;
            c.v.set(0, 0, 0);
          }
          c.r.x += c.w.x * (dt / 1000) * (c.p.y > 0.03 ? 1 : 0);
          c.r.y += c.w.y * (dt / 1000) * (c.p.y > 0.03 ? 1 : 0);
          m.compose(c.p, q.setFromEuler(c.r), one);
          this.confetti!.setMatrixAt(i, m);
        });
        this.confetti.instanceMatrix.needsUpdate = true;
      }
    } else {
      // Planning: the start domino's arrow bobs; it pulses once a piece is placed.
      this.moveCamera(this.planPos, this.planLook, dt, 0.006);
    }
    // Start arrow above the start domino.
    const s = this.puzzle.slots[this.puzzle.start];
    const bob = Math.sin(this.time / 300) * 0.08;
    this.arrow.visible = this.phase === 'plan';
    this.arrow.position.copy(BoardView.world(s.x, s.y, T.DOMINO_HEIGHT + 0.45 + bob));
    const startDom = this.dominoes.get(this.puzzle.start);
    if (startDom) {
      const m = startDom.mesh.material as THREE.MeshStandardMaterial;
      const pulse = this.startPulse && this.phase === 'plan' ? 0.25 + 0.25 * Math.sin(this.time / 220) : 0;
      m.emissive.set(0x06ffff);
      m.emissiveIntensity = pulse;
    }
    // Placed pieces settle with a small bounce.
    for (const d of this.dominoes.values()) {
      if (d.root.scale.x < 1) {
        const k = Math.min(1, d.root.scale.x + dt / 120);
        d.root.scale.setScalar(k);
        if (k >= 1) d.root.scale.setScalar(1);
      }
    }
  }

  private markStops(r: ChainResult): void {
    for (const s of r.stops) {
      const slot = this.puzzle.slots[s];
      const geo = new THREE.RingGeometry(0.5, 0.6, 40);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.9, depthWrite: false });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.copy(BoardView.world(slot.x, slot.y, 0.015));
      this.world.add(ring);
      this.stopRings.push(ring);
      this.track(geo, mat);
    }
  }

  private moveCamera(pos: THREE.Vector3, look: THREE.Vector3, dt: number, rate: number): void {
    const k = 1 - Math.exp(-dt * rate);
    this.camPos.lerp(pos, k);
    this.camLook.lerp(look, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  /** Follow the leading edge, preferring the branch nearest the flag (§10). */
  private followCamera(dt: number): void {
    if (this.reducedMotion || !this.result) return this.moveCamera(this.planPos, this.planLook, dt, 0.01);
    const recent = this.result.fallen.filter((f) => f.time <= this.chainT && f.time > this.chainT - 400);
    if (!recent.length) return this.moveCamera(this.camPos, this.camLook, dt, 0.01);
    const flag = this.puzzle.slots[this.puzzle.flag];
    let lead = recent[0];
    let best = Infinity;
    for (const f of recent) {
      const s = this.puzzle.slots[f.slot];
      const d = Math.hypot(s.x - flag.x, s.y - flag.y);
      if (d < best) {
        best = d;
        lead = f;
      }
    }
    // Widen to keep other active branches in view.
    let spread = 0;
    const ls = this.puzzle.slots[lead.slot];
    for (const f of recent) {
      const s = this.puzzle.slots[f.slot];
      spread = Math.max(spread, Math.hypot(s.x - ls.x, s.y - ls.y));
    }
    const look = BoardView.world(ls.x, ls.y);
    const dist = Math.min(this.planDist, 10 + spread * 1.2);
    const el = 58 * D2R;
    const pos = look.clone().add(new THREE.Vector3(0, Math.sin(el) * dist, Math.cos(el) * dist));
    this.moveCamera(pos, look, dt, 0.005);
  }

  private lingerCamera(r: ChainResult, dt: number): void {
    if (this.reducedMotion || !r.stops.length) return this.moveCamera(this.planPos, this.planLook, dt, 0.006);
    let x = 0;
    let y = 0;
    for (const s of r.stops) {
      x += this.puzzle.slots[s].x;
      y += this.puzzle.slots[s].y;
    }
    x /= r.stops.length;
    y /= r.stops.length;
    const look = BoardView.world(x, y);
    const el = 55 * D2R;
    const dist = Math.min(this.planDist, 15);
    this.moveCamera(look.clone().add(new THREE.Vector3(0, Math.sin(el) * dist, Math.cos(el) * dist)), look, dt, 0.004);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.clear();
    this.renderer.dispose();
  }
}

function tableTexture(base: string, grain: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 768;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = grain;
    ctx.globalAlpha = 0.08 + seeded(i) * 0.12;
    ctx.lineWidth = 1 + seeded(i + 3) * 3;
    ctx.beginPath();
    const y = seeded(i + 9) * c.height;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(c.width * 0.3, y + (seeded(i + 1) - 0.5) * 30, c.width * 0.7, y + (seeded(i + 2) - 0.5) * 30, c.width, y + (seeded(i + 4) - 0.5) * 20);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(c.width / 2, c.height / 2, c.width * 0.2, c.width / 2, c.height / 2, c.height * 0.7);
  g.addColorStop(0, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
