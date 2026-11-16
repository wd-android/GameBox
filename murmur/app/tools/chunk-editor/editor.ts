/**
 * Chunk editor (§12, developer only): place and size hazards, strays,
 * thermals and trees; see the clear lane for the tier; fly through the chunk
 * with the real simulation; save and load JSON.
 *
 * Run `npm run dev` and open /tools/chunk-editor/.
 */
import { TUNING } from '../../src/config/tuning';
import { wireSpans, type Chunk } from '../../src/world/chunk';
import { checkLane, freeGrid, LANE_RES } from '../../src/world/lane';
import { Flight } from '../../src/sim/flight';
import { Pilot } from '../../src/game/autopilot';
import chunks from '../../src/world/chunks/chunks.json';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const S = canvas.width / TUNING.SKY_W;
const report = document.getElementById('report')!;
const json = document.getElementById('json') as HTMLTextAreaElement;
const tierSel = document.getElementById('tier') as HTMLSelectElement;
const pickSel = document.getElementById('pick') as HTMLSelectElement;

let chunk: Chunk = { id: 'new', tier: 1, clouds: [], wires: [], pylons: [], strays: [], thermals: [] };
let tool = 'cloud';
let flying: Flight | null = null;
let pilot: Pilot | null = null;

const tools = ['cloud', 'wire', 'pylon', 'stray', 'thermal', 'tree'];
const toolsEl = document.getElementById('tools')!;
for (const t of tools) {
  const b = document.createElement('button');
  b.textContent = t;
  b.onclick = () => {
    tool = t;
    toolsEl.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  };
  if (t === tool) b.classList.add('on');
  toolsEl.append(b, document.createTextNode(' '));
}
for (const c of chunks as Chunk[]) pickSel.append(new Option(c.id, c.id));

const toTile = (e: MouseEvent) => {
  const r = canvas.getBoundingClientRect();
  return { x: Math.round(((e.clientX - r.left) / S) * 10) / 10, y: Math.round(((canvas.height - (e.clientY - r.top)) / S) * 10) / 10 };
};
const sx = (x: number) => x * S;
const sy = (y: number) => canvas.height - y * S;

function analyse(): void {
  chunk.tier = Number(tierSel.value);
  const w = TUNING.TIER_LANE[chunk.tier - 1];
  const lane = checkLane(chunk, w);
  report.textContent = `Tier ${chunk.tier}: clear lane ${w} tiles wide – ${lane.ok ? '✓ found' : '✗ NONE'}\n${chunk.clouds.length} clouds · ${chunk.wires.length} wires · ${chunk.pylons.length} pylons · ${chunk.strays.length} strays · ${chunk.thermals.length} thermals · ${chunk.tree ? 'tree' : 'no tree'}`;
}

function draw(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const w = TUNING.TIER_LANE[chunk.tier - 1];
  const g = freeGrid(chunk, w);
  ctx.fillStyle = 'rgba(6,255,255,0.08)';
  for (let j = 0; j < g.rows; j++) for (let i = 0; i < g.cols; i++) if (g.free[j * g.cols + i]) ctx.fillRect(i * LANE_RES * S, canvas.height - (j + 1) * LANE_RES * S, LANE_RES * S, LANE_RES * S);
  const lane = checkLane(chunk, w);
  ctx.strokeStyle = '#06ffff';
  ctx.beginPath();
  lane.path.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
  ctx.stroke();
  for (const t of chunk.thermals) {
    ctx.fillStyle = 'rgba(255,224,138,0.2)';
    ctx.fillRect(sx(t.x), sy(t.y + t.h), t.w * S, t.h * S);
  }
  for (const c of chunk.clouds) {
    ctx.fillStyle = '#2b2140';
    ctx.strokeStyle = '#ff9a3c';
    ctx.beginPath();
    ctx.arc(sx(c.x), sy(c.y), c.r * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (c.drift) {
      ctx.strokeStyle = '#ff9a3c55';
      ctx.strokeRect(sx(c.x - c.drift.amp - c.r), sy(c.y + c.r), (2 * c.drift.amp + 2 * c.r) * S, 2 * c.r * S);
    }
  }
  for (const wi of chunk.wires) {
    ctx.strokeStyle = '#1a0b2e';
    ctx.lineWidth = 3;
    for (const [a, b] of wireSpans(wi)) {
      ctx.beginPath();
      ctx.moveTo(sx(a), sy(wi.y));
      ctx.lineTo(sx(b), sy(wi.y));
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }
  ctx.fillStyle = '#1a0b2e';
  for (const p of chunk.pylons) ctx.fillRect(sx(p.x), sy(p.y + p.h), p.w * S, p.h * S);
  ctx.fillStyle = '#fff3c4';
  for (const s of chunk.strays) ctx.fillRect(sx(s.x) - 3, sy(s.y) - 3, 6, 6);
  if (chunk.tree) {
    ctx.strokeStyle = '#ffd166';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(sx(chunk.tree.x), sy(chunk.tree.y), TUNING.TREE_RADIUS * S, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath();
    ctx.arc(sx(chunk.tree.x), sy(chunk.tree.y), 0.8 * S, 0, Math.PI * 2);
    ctx.fill();
  }
  if (flying && pilot) {
    for (let k = 0; k < 2 && !flying.over; k++) flying.step(pilot.target());
    ctx.fillStyle = '#000';
    const base = 26; // the calm chunk sits at 6–26, the chunk under test above it
    for (const b of flying.birds) ctx.fillRect(sx(b.x) - 2, sy(b.y - base) - 2, 4, 4);
    if (flying.leader.y > base + 21 || flying.over) {
      report.textContent += `\nFly-through: ${flying.over ? 'flock lost' : `${flying.n} birds made it through`}`;
      flying = null;
    }
  }
  requestAnimationFrame(draw);
}

canvas.addEventListener('click', (e) => {
  const p = toTile(e);
  if (tool === 'cloud') chunk.clouds.push({ x: p.x, y: p.y, r: 1.6 });
  else if (tool === 'wire') chunk.wires.push({ y: p.y, gaps: [[p.x - 1.5, p.x + 1.5]] });
  else if (tool === 'pylon') chunk.pylons.push({ x: p.x - 0.25, y: p.y - 0.45, w: 0.5, h: 0.9 });
  else if (tool === 'stray') chunk.strays.push(p);
  else if (tool === 'thermal') chunk.thermals.push({ x: p.x - 1.2, y: p.y - 4, w: 2.4, h: 8 });
  else if (tool === 'tree') chunk.tree = p;
  analyse();
});
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const p = toTile(e);
  const near = (x: number, y: number, r = 0.6) => Math.hypot(x - p.x, y - p.y) < r;
  chunk.clouds = chunk.clouds.filter((c) => !near(c.x, c.y, c.r));
  chunk.wires = chunk.wires.filter((w) => Math.abs(w.y - p.y) > 0.3);
  chunk.pylons = chunk.pylons.filter((q) => !near(q.x + q.w / 2, q.y + q.h / 2));
  chunk.strays = chunk.strays.filter((s) => !near(s.x, s.y));
  chunk.thermals = chunk.thermals.filter((t) => !(p.x >= t.x && p.x <= t.x + t.w && p.y >= t.y && p.y <= t.y + t.h));
  if (chunk.tree && near(chunk.tree.x, chunk.tree.y, 1)) delete chunk.tree;
  analyse();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = toTile(e);
  const d = e.deltaY < 0 ? 0.1 : -0.1;
  for (const c of chunk.clouds) if (Math.hypot(c.x - p.x, c.y - p.y) < c.r) c.r = Math.max(0.5, c.r + d);
  for (const w of chunk.wires) if (Math.abs(w.y - p.y) < 0.4) w.gaps = w.gaps.map(([a, b]) => [a - d / 2, b + d / 2]);
  for (const t of chunk.thermals) if (p.x >= t.x && p.x <= t.x + t.w) t.h = Math.max(2, t.h + d * 5);
  analyse();
});
document.getElementById('fly')!.onclick = () => {
  const empty: Chunk = { id: 'calm', tier: 1, clouds: [], wires: [], pylons: [], strays: [], thermals: [] };
  flying = new Flight({ species: 'starlings', seed: 1, chunks: [empty], runsPlayed: 9, hawks: false, scripted: [empty, chunk, empty], startBirds: 30 });
  pilot = new Pilot(flying);
};
document.getElementById('clear')!.onclick = () => {
  chunk = { id: 'new', tier: Number(tierSel.value), clouds: [], wires: [], pylons: [], strays: [], thermals: [] };
  analyse();
};
document.getElementById('save')!.onclick = () => (json.value = JSON.stringify(chunk, null, 1));
document.getElementById('load')!.onclick = () => {
  chunk = JSON.parse(json.value);
  tierSel.value = String(chunk.tier);
  analyse();
};
pickSel.onchange = () => {
  chunk = JSON.parse(JSON.stringify((chunks as Chunk[]).find((c) => c.id === pickSel.value)));
  tierSel.value = String(chunk.tier);
  analyse();
};
tierSel.onchange = analyse;
analyse();
draw();
