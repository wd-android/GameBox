/**
 * Chart editor (§13, developer only): place rocks, currents and the harbour
 * mouth; show the safe-route grid; run any night on the chart with the real
 * simulation and the automatic keeper. Open with `npm run dev` at /tools/chart-editor/.
 * Edits change the chart in memory; copy the JSON into src/charts/charts.ts to keep them.
 */
import { CHARTS, type Chart } from '../../src/charts/charts';
import { RouteGrid, clearRouteCache } from '../../src/sim/routes';
import { NightSim } from '../../src/sim/night';
import { Keeper } from '../../src/sim/keeper';
import { NO_UPGRADES } from '../../src/sim/beam';
import { night } from '../../src/nights/nights';
import { TUNING } from '../../src/config/tuning';
import { edgePoints, runAlert } from '../routes-check';

const S = 36;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const g = canvas.getContext('2d')!;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let chart: Chart = CHARTS.bay;
let grid = new RouteGrid(chart);
let tool: 'rock' | 'current' | 'harbour' = 'rock';
let sim: NightSim | null = null;
let keeper: Keeper | null = null;

const tools = $('tools');
for (const t of ['rock', 'current', 'harbour'] as const) {
  const b = document.createElement('button');
  b.textContent = t;
  b.onclick = () => {
    tool = t;
    tools.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  };
  if (t === 'rock') b.classList.add('on');
  tools.append(b, ' ');
}

function changed(): void {
  // Rebuild, and drop the simulation's cached grid so a run sees the edit too.
  clearRouteCache();
  grid = new RouteGrid(chart);
  $<HTMLTextAreaElement>('json').value = JSON.stringify({ rocks: chart.rocks, currents: chart.currents, harbour: chart.harbour }, null, 1);
  draw();
}

function draw(): void {
  g.clearRect(0, 0, canvas.width, canvas.height);
  if ($<HTMLInputElement>('grid').checked) {
    const max = Math.max(...Array.from(grid.dist).filter(Number.isFinite));
    for (let i = 0; i < grid.safe.length; i++) {
      const c = grid.centre(i);
      const d = grid.dist[i];
      g.fillStyle = !grid.safe[i] ? 'rgba(255,80,80,.25)' : Number.isFinite(d) ? `rgba(80,255,140,${0.35 - (0.3 * d) / max})` : 'rgba(255,255,0,.3)';
      g.fillRect((c.x - 0.125) * S, (c.y - 0.125) * S, S / 4 - 0.5, S / 4 - 0.5);
    }
  }
  for (const c of chart.currents) {
    g.strokeStyle = '#8fb8ff';
    g.strokeRect(c.x * S, c.y * S, c.w * S, c.h * S);
    g.fillStyle = '#8fb8ff';
    g.fillText(`→ from night ${c.from} (${c.dx.toFixed(1)},${c.dy.toFixed(1)})`, c.x * S + 4, c.y * S + 12);
  }
  for (const r of chart.rocks) {
    g.fillStyle = '#6b5a4a';
    g.beginPath();
    g.arc(r.x * S, r.y * S, r.r * S, 0, Math.PI * 2);
    g.fill();
  }
  const h = chart.harbour;
  g.strokeStyle = '#ffd27a';
  g.beginPath();
  g.arc(h.x * S, h.y * S, h.r * S, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#1d1530';
  g.fillRect(0, TUNING.SEA_H * S, canvas.width, 2 * S);
  if (sim) {
    const L = TUNING.LIGHTHOUSE;
    const b = sim.beam;
    g.fillStyle = 'rgba(255,210,122,.25)';
    g.beginPath();
    g.moveTo(L.x * S, L.y * S);
    g.arc(L.x * S, L.y * S, b.reach * S, ((b.angle - b.halfWidth - 90) * Math.PI) / 180, ((b.angle + b.halfWidth - 90) * Math.PI) / 180);
    g.fill();
    for (const f of sim.fog) {
      g.fillStyle = 'rgba(200,210,230,.25)';
      g.beginPath();
      g.arc(f.x * S, f.y * S, f.r * S, 0, Math.PI * 2);
      g.fill();
    }
    for (const bt of sim.boats) {
      if (bt.outcome !== 'sailing') continue;
      g.fillStyle = bt.alert > 0 ? '#fff3b0' : bt.danger ? '#ff5a4a' : '#c2412d';
      g.beginPath();
      g.arc(bt.x * S, bt.y * S, 5, 0, Math.PI * 2);
      g.fill();
    }
  }
}

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const x = e.offsetX / S;
  const y = e.offsetY / S;
  chart.rocks = chart.rocks.filter((r) => Math.hypot(r.x - x, r.y - y) > r.r);
  chart.currents = chart.currents.filter((c) => !(x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h));
  changed();
});
canvas.addEventListener('click', (e) => {
  const x = Math.round((e.offsetX / S) * 10) / 10;
  const y = Math.round((e.offsetY / S) * 10) / 10;
  if (tool === 'rock') chart.rocks.push({ x, y, r: 0.45 });
  if (tool === 'harbour') chart.harbour = { ...chart.harbour, x, y };
  if (tool === 'current') chart.currents.push({ x: 0, y, w: TUNING.SEA_W, h: 2, dx: 1, dy: 0, k: 1, from: 5 });
  changed();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const x = e.offsetX / S;
  const y = e.offsetY / S;
  const r = chart.rocks.find((r) => Math.hypot(r.x - x, r.y - y) <= r.r + 0.2);
  if (r) r.r = Math.max(0.2, Math.min(1.2, r.r + (e.deltaY < 0 ? 0.05 : -0.05)));
  changed();
});
$('chart').addEventListener('change', (e) => {
  chart = CHARTS[(e.target as HTMLSelectElement).value as Chart['id']];
  changed();
});
$('grid').addEventListener('change', draw);
$('run').addEventListener('click', () => {
  const n = Number($<HTMLInputElement>('night').value);
  const def = { ...night(n), chart: chart.id };
  sim = new NightSim(def, NO_UPGRADES);
  keeper = new Keeper();
  const loop = () => {
    if (!sim || !keeper) return;
    for (let k = 0; k < 2 && !sim.over; k++) {
      keeper.act(sim);
      sim.step();
    }
    draw();
    const r = sim.result();
    $('report').textContent = `night ${n} on ${chart.name}: t=${sim.time.toFixed(1)}s, landed ${r.landed}, strikes ${r.strikes}${sim.over ? ` – over, ${r.stars} stars` : ''}`;
    if (!sim.over) requestAnimationFrame(loop);
  };
  loop();
});
$('stop').addEventListener('click', () => {
  sim = null;
  draw();
});
$('check').addEventListener('click', () => {
  const fails: string[] = [];
  let total = 0;
  for (const kind of ['fishing', 'dinghy', 'trawler'] as const)
    for (const p of edgePoints(chart.id))
      for (const s of [-25, 0, 25]) {
        total++;
        const o = runAlert(chart.id, kind, p.x, p.y, s);
        if (o !== 'landed') fails.push(`${kind} at ${p.x.toFixed(1)},${p.y.toFixed(1)} ${s}°: ${o}`);
      }
  $('report').textContent = `${total - fails.length}/${total} kept-lit starts reach the harbour\n${fails.slice(0, 20).join('\n')}`;
});
changed();
