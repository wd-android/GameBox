/**
 * Puzzle editor (§14.1, developer only): draw runs as lines and curves with
 * slots placed automatically at standard spacing; join runs into forks and
 * merges; add ramps; mark gaps, start and flag; set the tray. The solver runs
 * continuously; the chain plays with the same calculation as the game.
 *
 * Run `npm run dev` and open /tools/editor/.
 */
import { TUNING } from '../../src/config/tuning';
import { calculate, type ChainResult } from '../../src/chain/chain';
import type { PieceKind, Puzzle } from '../../src/chain/model';
import { solve } from '../../src/chain/solver';
import { PuzzleBuilder, samplePath } from '../../src/puzzles/builder';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const report = document.getElementById('report')!;
const json = document.getElementById('json') as HTMLTextAreaElement;
const S = canvas.width / TUNING.BOARD_W;

let b = new PuzzleBuilder();
let start = -1;
let flag = -1;
let tool = 'run';
let waypoints: [number, number][] = [];
let branchFrom: number | null = null;
let pick: number | null = null;
let chain: { r: ChainResult; t0: number } | null = null;

const toScreen = (x: number, y: number) => [x * S, canvas.height - y * S];
const toBoard = (e: MouseEvent): [number, number] => {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) / S, (canvas.height - (e.clientY - r.top)) / S];
};
const nearest = (x: number, y: number, max = 0.4) => {
  let best = -1;
  let bd = max;
  b.slots.forEach((s) => {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) {
      bd = d;
      best = s.id;
    }
  });
  return best;
};

function tray(): PieceKind[] {
  const v = (document.getElementById('tray') as HTMLSelectElement).value;
  return v === 'sst' ? ['standard', 'standard', 'tall'] : v === 's' ? ['standard'] : ['standard', 'standard', 'standard'];
}

function puzzle(): Puzzle | null {
  if (start < 0 || flag < 0) return null;
  return b.build('editor', start, flag, tray());
}

function analyse(): void {
  const p = puzzle();
  if (!p) {
    report.textContent = `${b.slots.length} slots. Set a start and a flag.`;
    return;
  }
  const r = solve(p);
  report.textContent = [
    `${p.slots.length} slots · ${p.slots.filter((s) => s.holds === 'gap').length} gaps · clearance ${b.minClearance().toFixed(2)}`,
    `Solvable: ${r.solvable}   Par: ${r.par}`,
    `Winning placements: ${r.winning} (${r.winningAtPar} at par) of ${r.placements} · share ${(r.solutionShare * 100).toFixed(1)}%`,
    `Decoy gaps: ${r.decoyGaps.join(', ') || '—'}   Essential: ${r.essentialGaps.join(', ') || '—'}`,
    `Needs tall: ${r.needsTall}   Needs ball: ${r.needsBall}   Forks: ${r.forks}`,
    r.acceptable ? '✓ Acceptable (§6.3)' : '✗ ' + r.problems.join('; '),
  ].join('\n');
}

function draw(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const now = performance.now();
  const fallen = new Map<number, number>();
  if (chain) for (const f of chain.r.fallen) if (f.time <= now - chain.t0) fallen.set(f.slot, f.time);
  // Links.
  ctx.strokeStyle = '#ffffff30';
  for (const l of b.links) {
    const a = b.slots[l.from];
    const c = b.slots[l.to];
    const [x1, y1] = toScreen(a.x, a.y);
    const [x2, y2] = toScreen(c.x, c.y);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  for (const r of b.ramps) {
    const [x1, y1] = toScreen(b.slots[r.trigger].x, b.slots[r.trigger].y);
    const [x2, y2] = toScreen(b.slots[r.target].x, b.slots[r.target].y);
    ctx.strokeStyle = '#ffc93c';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const s of b.slots) {
    const [x, y] = toScreen(s.x, s.y);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((-s.facing * Math.PI) / 180);
    const down = fallen.has(s.id);
    ctx.fillStyle = s.id === start ? '#06ffff' : s.id === flag ? '#ffc93c' : s.holds === 'gap' ? 'transparent' : down ? '#ff4b4b88' : '#ff4b4b';
    ctx.strokeStyle = s.holds === 'gap' ? '#ffffffaa' : '#00000055';
    const w = (down ? T.DOMINO_HEIGHT : T.DOMINO_THICK) * S;
    ctx.fillRect(down ? 0 : -w / 2, (-T.DOMINO_WIDTH * S) / 2, w, T.DOMINO_WIDTH * S);
    ctx.strokeRect(-(T.DOMINO_THICK * S) / 2, (-T.DOMINO_WIDTH * S) / 2, T.DOMINO_THICK * S, T.DOMINO_WIDTH * S);
    ctx.restore();
    ctx.fillStyle = '#ffffff99';
    ctx.font = '9px sans-serif';
    ctx.fillText(String(s.id), x + 6, y - 6);
  }
  if (waypoints.length) {
    ctx.strokeStyle = '#06ffff';
    ctx.beginPath();
    waypoints.forEach(([x, y], i) => {
      const [sx, sy] = toScreen(x, y);
      if (i) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
    });
    ctx.stroke();
  }
  requestAnimationFrame(draw);
}
const T = TUNING;

canvas.addEventListener('click', (e) => {
  const [x, y] = toBoard(e);
  const hit = nearest(x, y);
  if (tool === 'run') {
    if (!waypoints.length && hit >= 0) {
      branchFrom = hit;
      return;
    }
    waypoints.push([x, y]);
    return;
  }
  if (hit < 0) return;
  if (tool === 'gap') b.slots[hit].holds = b.slots[hit].holds === 'gap' ? 'standard' : 'gap';
  else if (tool === 'start') start = hit;
  else if (tool === 'flag') flag = hit;
  else if (tool === 'erase') {
    b.links = b.links.filter((l) => l.from !== hit && l.to !== hit);
    b.slots[hit].holds = 'gap';
  } else if (tool === 'link' || tool === 'ramp') {
    if (pick === null) pick = hit;
    else {
      if (tool === 'link') b.link(pick, hit);
      else b.ramp(pick, hit, Math.round(500 + Math.hypot(b.slots[pick].x - b.slots[hit].x, b.slots[pick].y - b.slots[hit].y) * 180));
      pick = null;
    }
  }
  analyse();
});

canvas.addEventListener('dblclick', () => {
  if (tool !== 'run' || waypoints.length < 2) return;
  let pts = waypoints;
  if (branchFrom !== null) {
    const f = b.slots[branchFrom];
    // Start one spacing from the slot we branch from.
    const dx = pts[0][0] - f.x;
    const dy = pts[0][1] - f.y;
    const d = Math.hypot(dx, dy) || 1;
    pts = [[f.x + (dx / d) * b.spacing, f.y + (dy / d) * b.spacing], ...pts];
  }
  const poses = samplePath(pts, b.spacing);
  const ids = b.run(poses, branchFrom ?? undefined);
  if (start < 0 && branchFrom === null) start = ids[0];
  waypoints = [];
  branchFrom = null;
  analyse();
});

document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((btn) =>
  btn.addEventListener('click', () => {
    tool = btn.dataset.tool!;
    pick = null;
    waypoints = [];
    document.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('alt', x !== btn));
  }),
);
document.getElementById('tray')!.addEventListener('change', analyse);
document.getElementById('play')!.addEventListener('click', () => {
  const p = puzzle();
  if (!p) return;
  const r = solve(p);
  chain = { r: calculate(p, r.parSolution ?? new Map()), t0: performance.now() };
  report.textContent += `\nPlayed the par solution: ${chain.r.won ? 'won' : 'stopped'} in ${chain.r.duration} ms.`;
});
document.getElementById('clear')!.addEventListener('click', () => {
  b = new PuzzleBuilder();
  start = flag = -1;
  chain = null;
  analyse();
});
document.getElementById('save')!.addEventListener('click', () => {
  const p = puzzle();
  if (!p) return;
  const r = solve(p);
  p.par = r.par;
  json.value = JSON.stringify(p);
});
document.getElementById('load')!.addEventListener('click', () => {
  const p = JSON.parse(json.value) as Puzzle;
  b = new PuzzleBuilder();
  b.slots = p.slots.map((s) => ({ ...s }));
  b.links = p.links.filter((l) => l.reach === 1);
  b.ramps = p.ramps.map((r) => ({ ...r }));
  start = p.start;
  flag = p.flag;
  analyse();
});

analyse();
draw();
