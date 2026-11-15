import levelData from './levels.json';
import { BALLS, TUNING, type BallId } from '../config/tuning';
import { defaultParams, generateCube, type Bands, type Cube } from '../maze/generator';

/** A level (§9.1): a handful of numbers from which the cube is generated on the device. */
export interface LevelDef {
  id: number;
  stage: number;
  n: number;
  seed: number;
  routeFaces: number;
  windiness: number;
  holeShare: number;
  bands?: Bands;
}

export const LEVELS = (levelData as unknown as { levels: LevelDef[] }).levels;

export const STAGES = [
  { stage: 1, name: 'First Rolls', n: 3, introduces: 'Rolling and gates' },
  { stage: 2, name: 'Dead Ends', n: 4, introduces: 'Dead ends · silver ball' },
  { stage: 3, name: 'Holes', n: 5, introduces: 'Holes · gold ball' },
  { stage: 4, name: 'Long Routes', n: 6, introduces: 'Longer routes' },
];

/** First Journey level at which each ball becomes available. */
export const BALL_UNLOCK_LEVEL: Record<BallId, number> = { bronze: 1, silver: 11, gold: 31 };

const cache = new Map<string, Cube>();

export function levelCube(level: LevelDef): Cube {
  const key = `L${level.id}`;
  let c = cache.get(key);
  if (!c) {
    c = generateCube(level.n, level.seed, { routeFaces: level.routeFaces, windiness: level.windiness, holeShare: level.holeShare, bands: level.bands });
    cache.set(key, c);
  }
  return c;
}

/** Explore and Daily Cube use the default parameters for the size; Explore has no holes. */
export function codeCube(n: number, seed: number, holes: boolean): Cube {
  const key = `C${n}-${seed}-${holes}`;
  let c = cache.get(key);
  if (!c) {
    c = generateCube(n, seed, defaultParams(n), holes);
    cache.set(key, c);
  }
  return c;
}

/** §9.4: par follows from the cube and the ball. */
export function parTime(cube: Cube, ball: BallId): number {
  const gatesOnRoute = cube.routeFaces.length - 1;
  return cube.measures.length / (TUNING.PAR_SPEED_FACTOR * BALLS[ball].vMax) + TUNING.PAR_TURN_SECONDS * gatesOnRoute;
}

export function score(cube: Cube, ball: BallId, seconds: number): { score: number; stars: number; par: number } {
  const par = parTime(cube, ball);
  const base = 100 * cube.n;
  const timeBonus = base * Math.max(0, Math.min(2, par / Math.max(0.001, seconds)));
  const total = Math.round((base + timeBonus) * BALLS[ball].scoreFactor);
  const stars = seconds <= par ? 3 : seconds <= 1.5 * par ? 2 : 1;
  return { score: total, stars, par };
}

/** Daily Cube (§9.3): seed is the date as a number; size cycles 4, 5, 6 by day. */
export function dailyFor(key: string): { n: number; seed: number } {
  const seed = Number(key.replace(/-/g, ''));
  const [y, m, d] = key.split('-').map(Number);
  const day = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return { n: [4, 5, 6][day % 3], seed };
}
