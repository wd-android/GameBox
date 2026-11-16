import type { Topology } from './topology';

/**
 * Solving (§6.8): the maze is perfect, so a breadth-first search from the
 * start gives the one route to the finish. No rendering code.
 */

/** Breadth-first search; returns parent links from `from`. */
export function bfs(topo: Topology, open: Uint8Array, from: number): Int32Array {
  const parent = new Int32Array(topo.cellCount).fill(-2);
  parent[from] = -1;
  const queue = [from];
  for (let qi = 0; qi < queue.length; qi++) {
    const c = queue[qi];
    for (let s = 0; s < 4; s++) {
      if (!(open[c] & (1 << s))) continue;
      const t = topo.neighbour[c * 4 + s];
      if (parent[t] !== -2) continue;
      parent[t] = c;
      queue.push(t);
    }
  }
  return parent;
}

export function solve(topo: Topology, open: Uint8Array, start: number, finish: number): number[] {
  const parent = bfs(topo, open, start);
  if (parent[finish] === -2) return [];
  const path: number[] = [];
  for (let c = finish; c !== -1; c = parent[c]) path.push(c);
  return path.reverse();
}
