import { SPECIES, type SpeciesId } from '../config/tuning';

/**
 * Missions (§7.3): about 40, built from templates. Three are active at a
 * time; completing one pays feathers and the next takes its place. Every
 * five completed raises the player's rank.
 */
export type MissionKind = 'bank' | 'flock' | 'hawks' | 'murmurs' | 'gather' | 'species' | 'trees' | 'survive';

export interface Mission {
  id: number;
  kind: MissionKind;
  goal: number;
  species?: SpeciesId;
  reward: number;
}

export interface RunReport {
  species: SpeciesId;
  score: number;
  maxFlock: number;
  hawksPassed: number;
  murmurations: number;
  gathered: number;
  banks: number;
  seconds: number;
}

export function describe(m: Mission): string {
  switch (m.kind) {
    case 'bank':
      return `Bank ${m.goal} points in one run`;
    case 'flock':
      return `Reach a flock of ${m.goal}`;
    case 'hawks':
      return `Pass ${m.goal} hawks in one run`;
    case 'murmurs':
      return m.goal === 1 ? 'Make a murmuration' : `Make ${m.goal} murmurations in one run`;
    case 'gather':
      return `Gather ${m.goal.toLocaleString('en-GB')} birds in total`;
    case 'species':
      return `Bank ${m.goal} points with ${SPECIES[m.species!].name.toLowerCase()}`;
    case 'trees':
      return m.goal === 1 ? 'Bank at a roost tree' : `Bank at ${m.goal} roost trees in one run`;
    case 'survive':
      return `Fly for ${m.goal} seconds`;
  }
}

/** The mission list, in the order they become active (gentle first). */
export const MISSIONS: Mission[] = (() => {
  const list: Omit<Mission, 'id'>[] = [
    { kind: 'trees', goal: 1, reward: 10 },
    { kind: 'flock', goal: 30, reward: 10 },
    { kind: 'murmurs', goal: 1, reward: 10 },
    { kind: 'bank', goal: 100, reward: 15 },
    { kind: 'survive', goal: 60, reward: 15 },
    { kind: 'gather', goal: 100, reward: 15 },
    { kind: 'hawks', goal: 2, reward: 15 },
    { kind: 'flock', goal: 50, reward: 20 },
    { kind: 'bank', goal: 200, reward: 20 },
    { kind: 'trees', goal: 2, reward: 20 },
    { kind: 'murmurs', goal: 2, reward: 20 },
    { kind: 'gather', goal: 300, reward: 20 },
    { kind: 'hawks', goal: 4, reward: 20 },
    { kind: 'survive', goal: 90, reward: 25 },
    { kind: 'flock', goal: 80, reward: 25 },
    { kind: 'bank', goal: 400, reward: 25 },
    { kind: 'gather', goal: 500, reward: 25 },
    { kind: 'species', goal: 200, species: 'swallows', reward: 30 },
    { kind: 'murmurs', goal: 3, reward: 30 },
    { kind: 'trees', goal: 3, reward: 30 },
    { kind: 'hawks', goal: 6, reward: 30 },
    { kind: 'flock', goal: 120, reward: 30 },
    { kind: 'survive', goal: 120, reward: 35 },
    { kind: 'bank', goal: 800, reward: 35 },
    { kind: 'gather', goal: 1000, reward: 35 },
    { kind: 'species', goal: 500, species: 'starlings', reward: 35 },
    { kind: 'hawks', goal: 10, reward: 40 },
    { kind: 'murmurs', goal: 5, reward: 40 },
    { kind: 'flock', goal: 180, reward: 40 },
    { kind: 'gather', goal: 2000, reward: 40 },
    { kind: 'species', goal: 100, species: 'geese', reward: 45 },
    { kind: 'bank', goal: 1500, reward: 45 },
    { kind: 'trees', goal: 4, reward: 45 },
    { kind: 'survive', goal: 180, reward: 50 },
    { kind: 'hawks', goal: 15, reward: 50 },
    { kind: 'flock', goal: 250, reward: 55 },
    { kind: 'species', goal: 800, species: 'swallows', reward: 55 },
    { kind: 'murmurs', goal: 8, reward: 60 },
    { kind: 'bank', goal: 3000, reward: 60 },
    { kind: 'gather', goal: 5000, reward: 60 },
  ];
  return list.map((m, id) => ({ id, ...m }));
})();

export const ACTIVE_COUNT = 3;

/** Progress towards a mission: per-run missions use this run; "gather" uses the lifetime total. */
export function progress(m: Mission, run: RunReport | null, totalGathered: number): number {
  if (m.kind === 'gather') return totalGathered;
  if (!run) return 0;
  switch (m.kind) {
    case 'bank':
      return run.score;
    case 'flock':
      return run.maxFlock;
    case 'hawks':
      return run.hawksPassed;
    case 'murmurs':
      return run.murmurations;
    case 'species':
      return run.species === m.species ? run.score : 0;
    case 'trees':
      return run.banks;
    case 'survive':
      return Math.floor(run.seconds);
  }
}

export function activeMissions(completed: number[]): Mission[] {
  return MISSIONS.filter((m) => !completed.includes(m.id)).slice(0, ACTIVE_COUNT);
}

export function rankFor(completedCount: number, perRank: number): number {
  return Math.floor(completedCount / perRank);
}
