import type { ShapeId } from './shapes';

/** A jar file (§8.2). The designer's recording is kept in a separate file so the app bundle stays small. */
export interface JarDef {
  id: number;
  stage: number;
  shape: ShapeId;
  palette: number[];
  /** Grains of each colour available, or null for unlimited. */
  limits: Record<string, number> | null;
  /** The finished grid, run-length compressed. */
  target: string;
  set: string;
  /** Seed for the simulation's random generator. */
  seed: number;
  layers: number;
  technique: 'flat' | 'mounds' | 'slopes' | 'zigzag' | 'picture';
  title: string;
}

export interface JarFile {
  version: 1;
  jars: JarDef[];
}

/** Designer recordings, keyed by jar id. */
export type RecordingFile = Record<string, string>;
