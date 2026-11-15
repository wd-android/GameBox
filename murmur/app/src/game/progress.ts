import { SPECIES, SPECIES_ORDER, TUNING, type SpeciesId } from '../config/tuning';
import type { SaveData } from '../state/save';
import { MISSIONS, activeMissions, progress, rankFor, type Mission, type RunReport } from './missions';

/** Runs, unlocks and the second sky (§6.9, §7.3, §9). */

export interface Sky {
  id: string;
  name: string;
  /** Gradient stops from the bottom of the screen to the top. */
  stops: string[];
  rank: number;
}

export const SKIES: Sky[] = [
  { id: 'dusk', name: 'Dusk', stops: ['#ff7a2f', '#e8455e', '#9259fe', '#3a1478', '#1b043b'], rank: 0 },
  { id: 'aurora', name: 'Northern lights', stops: ['#06343f', '#0b6e74', '#3fe0c5', '#5b33a0', '#120228'], rank: 1 },
];

export function rank(save: SaveData): number {
  return rankFor(save.completed.length, TUNING.MISSIONS_PER_RANK);
}

export function speciesUnlocked(save: SaveData, id: SpeciesId): boolean {
  return save.totalGathered >= SPECIES[id].unlockGathered;
}

export function skyUnlocked(save: SaveData, id: string): boolean {
  return rank(save) >= (SKIES.find((s) => s.id === id)?.rank ?? 99);
}

export interface RunOutcome {
  feathers: number;
  missionFeathers: number;
  newBest: boolean;
  completed: Mission[];
  unlockedSpecies: SpeciesId[];
  rankUp: boolean;
  skyUnlocked: boolean;
}

/** Records a finished run. Only banked score counts (§6.9). */
export function recordRun(save: SaveData, run: RunReport): RunOutcome {
  const beforeRank = rank(save);
  const beforeSpecies = SPECIES_ORDER.filter((s) => speciesUnlocked(save, s));
  const beforeSky = skyUnlocked(save, 'aurora');
  save.runsPlayed++;
  save.totalGathered += run.gathered;
  const feathers = Math.floor(run.score * TUNING.FEATHERS_PER_POINT);
  save.feathers += feathers;
  const newBest = run.score > save.best;
  save.best = Math.max(save.best, run.score);
  save.bestBySpecies[run.species] = Math.max(save.bestBySpecies[run.species] ?? 0, run.score);

  // Missions: completing one pays feathers and the next takes its place; keep checking.
  const completed: Mission[] = [];
  let missionFeathers = 0;
  for (;;) {
    const done = activeMissions(save.completed).filter((m) => progress(m, run, save.totalGathered) >= m.goal);
    if (!done.length) break;
    for (const m of done) {
      save.completed.push(m.id);
      completed.push(m);
      missionFeathers += m.reward;
    }
  }
  save.feathers += missionFeathers;
  const unlockedSpecies = SPECIES_ORDER.filter((s) => speciesUnlocked(save, s) && !beforeSpecies.includes(s));
  return { feathers, missionFeathers, newBest, completed, unlockedSpecies, rankUp: rank(save) > beforeRank, skyUnlocked: !beforeSky && skyUnlocked(save, 'aurora') };
}

export function missionCount(): number {
  return MISSIONS.length;
}
