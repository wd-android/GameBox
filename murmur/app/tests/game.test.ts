import { describe, expect, it } from 'vitest';
import { freshSave, migrate } from '../src/state/save';
import { MISSIONS, activeMissions, describe as describeMission } from '../src/game/missions';
import { rank, recordRun, skyUnlocked, speciesUnlocked } from '../src/game/progress';
import { TUNING } from '../src/config/tuning';

const run = (o: Partial<Parameters<typeof recordRun>[1]> = {}) => ({ species: 'starlings' as const, score: 0, maxFlock: 10, hawksPassed: 0, murmurations: 0, gathered: 0, banks: 0, seconds: 30, ...o });

describe('missions', () => {
  it('there are about 40, built from every template, three active at a time', () => {
    expect(MISSIONS.length).toBe(40);
    expect(new Set(MISSIONS.map((m) => m.kind)).size).toBe(8);
    expect(activeMissions([]).length).toBe(3);
    for (const m of MISSIONS) expect(describeMission(m).length).toBeGreaterThan(5);
  });

  it('completing one pays feathers and replaces it; every five raise the rank and unlock the second sky', () => {
    const s = freshSave();
    expect(skyUnlocked(s, 'aurora')).toBe(false);
    const out = recordRun(s, run({ score: 250, banks: 2, maxFlock: 60, murmurations: 2, seconds: 95, gathered: 150, hawksPassed: 3 }));
    expect(out.completed.length).toBeGreaterThanOrEqual(5);
    expect(out.missionFeathers).toBe(out.completed.reduce((a, m) => a + m.reward, 0));
    expect(s.feathers).toBe(Math.floor(250 / 50) + out.missionFeathers);
    expect(rank(s)).toBeGreaterThanOrEqual(1);
    expect(skyUnlocked(s, 'aurora')).toBe(true);
    expect(activeMissions(s.completed).length).toBe(3);
  });

  it('only the banked score counts and earns feathers', () => {
    const s = freshSave();
    const out = recordRun(s, run({ score: 0, seconds: 200 }));
    expect(out.feathers).toBe(0);
    expect(s.best).toBe(0);
  });
});

describe('unlocks', () => {
  it('species unlock by total birds gathered', () => {
    const s = freshSave();
    expect(speciesUnlocked(s, 'swallows')).toBe(false);
    recordRun(s, run({ gathered: 500 }));
    expect(speciesUnlocked(s, 'swallows')).toBe(true);
    expect(speciesUnlocked(s, 'geese')).toBe(false);
    recordRun(s, run({ gathered: 1500 }));
    expect(speciesUnlocked(s, 'geese')).toBe(true);
  });

  it('saves migrate', () => {
    const m = migrate({ feathers: 12, settings: { steering: 'draw' } });
    expect(m.feathers).toBe(12);
    expect(m.settings.steering).toBe('draw');
    expect(m.settings.music).toBe(true);
    expect(TUNING.REVIVE_COST).toBe(50);
  });
});
