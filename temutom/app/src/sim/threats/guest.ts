import type { ThreatModule } from './index';

/** Week 3: The Houseguest Who "Isn't a Cat Person" (spec §11.2, moved a week later). */
export const guest: ThreatModule = {
  id: 'guest',
  start(s, t) {
    t.data = { won: false };
    if (t.spec.boss) s.bossMorale = 2;
  },
  step(s, t) {
    // Boss: four seconds on Clive's lap, without eviction, once his Lap compliance has reached 60.
    if (t.spec.boss && !t.data.won && s.cat.sittingOn === 'guest' && s.cat.lapT >= 4) {
      const g = s.staff.find((m) => m.id === 'guest');
      if (g && g.compliance.lap >= 60) { t.data.won = true; s.events.push({ type: 'guestWon' }); }
    }
    return 0;
  },
  respond() { return null; },
  isDefeated(_s, t) { return !!t.data.won; },
  hook(s, t, name, m) {
    if (name === 'lapMet' && m.id === 'guest' && t.spec.boss && m.compliance.lap >= 60) {
      t.data.won = true;
      s.events.push({ type: 'guestWon' });
    }
    return null;
  },
};
