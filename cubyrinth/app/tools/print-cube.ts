/**
 * Prints a cube as text, one face at a time (build order stage 1).
 *   npm run print -- 5 48213
 */
import { defaultParams, generateCube } from '../src/maze/generator';
import { FACE_NAMES, cellIndex } from '../src/maze/topology';

const n = Number(process.argv[2] ?? 4);
const seed = Number(process.argv[3] ?? 1);
const cube = generateCube(n, seed, defaultParams(n));
const gateCells = new Set(cube.gates.flatMap((g) => [g.cellA, g.cellB]));

console.log(`Cube ${cube.version}-${n}-${seed} (attempt ${cube.attempt})`, cube.measures, 'route', cube.routeFaces.map((f) => FACE_NAMES[f]).join(' → '));
const onRoute = new Set(cube.solution);
const holes = new Set(cube.holes);
for (let f = 0; f < 6; f++) {
  const lines: string[] = [`Face ${FACE_NAMES[f]}  (columns along u →, rows along v ↓)`];
  for (let row = 0; row < n; row++) {
    let top = '';
    let mid = '';
    for (let col = 0; col < n; col++) {
      const c = cellIndex(n, f, col, row);
      const o = cube.open[c];
      top += '+' + (o & 8 ? (gateCells.has(c) && row === 0 ? '::' : '  ') : '--');
      const mark = c === cube.start ? 'S' : c === cube.finish ? 'F' : holes.has(c) ? 'O' : onRoute.has(c) ? '·' : ' ';
      mid += (o & 4 ? (gateCells.has(c) && col === 0 ? ':' : ' ') : '|') + mark + ' ';
    }
    const last = cellIndex(n, f, n - 1, row);
    lines.push(top + '+');
    lines.push(mid + (cube.open[last] & 1 ? ':' : '|'));
  }
  let bottom = '';
  for (let col = 0; col < n; col++) bottom += '+' + (cube.open[cellIndex(n, f, col, n - 1)] & 2 ? '::' : '--');
  lines.push(bottom + '+');
  console.log(lines.join('\n'));
}
