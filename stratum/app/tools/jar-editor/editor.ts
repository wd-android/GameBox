/**
 * Jar editor (§13, developer only). Choose a shape and palette, pour with the
 * real simulation while every input is recorded, keep the result as the
 * target with its recording, replay to confirm the score, and set colour
 * limits from the amounts actually used plus 15%.
 *
 * Run `npm run dev` and open /tools/jar-editor/.
 */
import { SAND_COLOURS } from '../../src/config/theme';
import { TUNING } from '../../src/config/tuning';
import { SandSim, replay } from '../../src/sand/sim';
import { accuracy, toleranceMap } from '../../src/sand/scoring';
import { encodeGrid, encodeRecording, decodeRecording } from '../../src/sand/rle';
import { maskFor, type ShapeId } from '../../src/jars/shapes';
import { paintSand } from '../../src/render/painter';
import { targetGrid } from '../../src/jars/target';
import type { JarDef, JarFile, RecordingFile } from '../../src/jars/types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('c');
const tcanvas = $<HTMLCanvasElement>('t');
const ctx = canvas.getContext('2d')!;
const tctx = tcanvas.getContext('2d')!;
const out = $<HTMLPreElement>('out');

let shape: ShapeId = 'straight';
let seed = 1001;
let sim = new SandSim(maskFor(shape), seed);
let palette = new Set<number>([1, 2, 3]);
let target: Uint8Array | null = null;
let targetRecording = '';
let targetUsed: Int32Array | null = null;
let holding = false;

function reset(): void {
  shape = $<HTMLSelectElement>('shape').value as ShapeId;
  seed = Number($<HTMLInputElement>('seed').value) || 1;
  sim = new SandSim(maskFor(shape), seed);
  sim.setColour([...palette][0] ?? 1);
  $<HTMLInputElement>('tilt').value = '0';
  drawPots();
}

function drawPots(): void {
  const wrap = $('pots');
  wrap.innerHTML = '';
  for (let c = 1; c <= 8; c++) {
    const b = document.createElement('button');
    const [r, g, bl] = SAND_COLOURS[c].rgb;
    b.className = `pot${sim.colour === c ? ' on' : ''}${palette.has(c) ? '' : ' off'}`;
    b.style.background = `rgb(${r},${g},${bl})`;
    b.title = SAND_COLOURS[c].name;
    b.onclick = (e) => {
      if (e.shiftKey) {
        if (palette.has(c)) palette.delete(c);
        else palette.add(c);
      } else {
        palette.add(c);
        sim.setColour(c);
      }
      drawPots();
    };
    wrap.append(b);
  }
}

function paint(c2d: CanvasRenderingContext2D, cells: Uint8Array, w: number, hgt: number): void {
  const m = maskFor(shape);
  const img = new ImageData(m.w, m.h);
  paintSand(new Uint32Array(img.data.buffer), cells, m, { patterns: false });
  const tmp = document.createElement('canvas');
  tmp.width = m.w;
  tmp.height = m.h;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  c2d.clearRect(0, 0, w, hgt);
  c2d.imageSmoothingEnabled = false;
  // Glass
  c2d.fillStyle = '#ffffff10';
  const sx = w / m.w;
  const sy = hgt / m.h;
  for (let i = 0; i < m.w * m.h; i++) if (m.inside[i]) c2d.fillRect((i % m.w) * sx, Math.floor(i / m.w) * sy, sx, sy);
  c2d.drawImage(tmp, 0, 0, w, hgt);
  c2d.fillStyle = '#06ffff';
  c2d.fillRect(0, m.fillRow * sy, 6, 1);
}

function column(e: PointerEvent): number {
  const r = canvas.getBoundingClientRect();
  return Math.floor(((e.clientX - r.left) / r.width) * TUNING.GRID_W);
}

canvas.addEventListener('pointerdown', (e) => {
  holding = true;
  canvas.setPointerCapture(e.pointerId);
  sim.setColumn(column(e));
  sim.setPouring(true);
});
canvas.addEventListener('pointermove', (e) => {
  if (holding) sim.setColumn(column(e));
});
const stop = () => {
  holding = false;
  sim.setPouring(false);
};
canvas.addEventListener('pointerup', stop);
canvas.addEventListener('pointercancel', stop);

$<HTMLInputElement>('tilt').addEventListener('input', (e) => {
  const v = Number((e.target as HTMLInputElement).value);
  $('tiltv').textContent = `${v}°`;
});
$('reset').onclick = reset;
$('shape').onchange = reset;
$('undo').onclick = () => sim.undo();

$('target').onclick = () => {
  target = sim.cells.slice();
  targetRecording = encodeRecording(sim.recording);
  targetUsed = sim.used.slice();
  paint(tctx, target, tcanvas.width, tcanvas.height);
  out.textContent = `Target kept: ${target.filter(Boolean).length} grains, ${sim.recording.length} input events over ${sim.tick} ticks.`;
};

$('replay').onclick = () => {
  if (!target) {
    out.textContent = 'Keep a target first.';
    return;
  }
  const m = maskFor(shape);
  const again = replay(m, seed, null, decodeRecording(targetRecording));
  const acc = accuracy(again.cells, toleranceMap(target, m), m, target);
  const ok = acc >= TUNING.DESIGNER_MIN_SELF_SCORE;
  out.textContent = `Replay scores ${(acc * 100).toFixed(2)}% against the target – ${ok ? 'OK' : 'FAILS the 97% check'}.`;
};

$('export').onclick = () => {
  if (!target || !targetUsed) {
    out.textContent = 'Keep a target first.';
    return;
  }
  const pal = [...palette].filter((c) => targetUsed![c] > 0);
  const limits: Record<string, number> = {};
  for (const c of pal) limits[c] = Math.ceil(targetUsed[c] * (1 + TUNING.LIMIT_MARGIN));
  const def: JarDef = {
    id: Number($<HTMLInputElement>('id').value),
    stage: Number($<HTMLInputElement>('stage').value),
    shape,
    palette: pal,
    limits,
    target: encodeGrid(target),
    set: $<HTMLInputElement>('set').value,
    seed,
    layers: pal.length,
    technique: 'picture',
    title: `${$<HTMLInputElement>('set').value} ${$<HTMLInputElement>('id').value}`,
  };
  const blob = new Blob([JSON.stringify({ jar: def, recording: targetRecording }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `jar-${def.id}.json`;
  a.click();
  out.textContent = `Exported jar ${def.id}. Limits (used + ${TUNING.LIMIT_MARGIN * 100}%): ${JSON.stringify(limits)}. Merge it into src/jars/data and tools/recordings.`;
};

$('load').onclick = async () => {
  const id = Number($<HTMLInputElement>('id').value);
  const name = id > 1000 ? 'daily' : 'match';
  const file = (await import(`../../src/jars/data/${name}.json`)).default as JarFile;
  const recs = (await import(`../recordings/${name}.json`)).default as RecordingFile;
  const def = file.jars.find((j) => j.id === id);
  if (!def) {
    out.textContent = `No jar ${id}.`;
    return;
  }
  $<HTMLSelectElement>('shape').value = def.shape;
  $<HTMLInputElement>('seed').value = String(def.seed);
  $<HTMLInputElement>('stage').value = String(def.stage);
  $<HTMLInputElement>('set').value = def.set;
  palette = new Set(def.palette);
  reset();
  target = targetGrid(def);
  targetRecording = recs[id];
  sim = replay(maskFor(def.shape), def.seed, null, decodeRecording(recs[id]));
  targetUsed = sim.used.slice();
  paint(tctx, target, tcanvas.width, tcanvas.height);
  out.textContent = `Loaded ${def.title} (${def.technique}, ${def.layers} layers). The replayed pour is shown on the left.`;
};

let acc = 0;
let last = performance.now();
function loop(now: number): void {
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) {
    sim.setTilt(Number($<HTMLInputElement>('tilt').value));
    sim.step();
    acc -= 1000 / 60;
  }
  paint(ctx, sim.cells, canvas.width, canvas.height);
  requestAnimationFrame(loop);
}

reset();
requestAnimationFrame(loop);
