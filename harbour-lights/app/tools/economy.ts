/**
 * Economy check against the balance target (§9.5): a player who plays three
 * nights and collects twice a day should afford a new building or level about
 * once a day in the first week. Nights are played by the keeper, with a strike
 * on every other night to stand in for a human player.
 */
import { BUILDINGS } from '../src/config/tuning';
import { night } from '../src/nights/nights';
import { NightSim } from '../src/sim/night';
import { keeperPlay } from '../src/sim/keeper';
import { freshSave } from '../src/state/save';
import { build, canBuild, collectEarnings, finishTutorial, reachedNight, recordNight } from '../src/game/progress';
import { hourlyRate } from '../src/town/town';

const HOUR = 3_600_000;
const save = freshSave(0);
finishTutorial(save, 0);
let now = 0;
let played = 0;
const report: string[] = [];
for (let day = 1; day <= 7; day++) {
  const bought: string[] = [];
  const tryBuy = () => {
    // The cheapest building or level the player can afford (lighthouse upgrades are optional comfort).
    for (;;) {
      const options = BUILDINGS.map((b) => ({ id: b.id, c: canBuild(save, b.id) })).filter((o) => o.c.ok) as { id: (typeof BUILDINGS)[number]['id']; c: { ok: true; cost: number } }[];
      if (!options.length) return;
      options.sort((a, b) => a.c.cost - b.c.cost);
      const o = options[0];
      build(save, o.id, now);
      bought.push(`${o.id}→${save.buildings[o.id]} (${o.c.cost})`);
    }
  };
  // Morning: collect, play three nights; evening: collect.
  now = (day - 1) * 24 * HOUR + 8 * HOUR;
  collectEarnings(save, now);
  for (let k = 0; k < 3; k++) {
    const n = reachedNight(save);
    const r = keeperPlay(new NightSim(night(n), save.upgrades));
    if (played++ % 2 === 1) {
      // A human usually loses a boat now and then: two stars, no clean bonus.
      r.stars = 2;
      r.total -= r.bonus + Math.round(r.catch / Math.max(1, r.landed));
      r.bonus = 0;
    }
    recordNight(save, n, r);
    now += HOUR / 4;
    tryBuy();
  }
  now = (day - 1) * 24 * HOUR + 20 * HOUR;
  collectEarnings(save, now);
  tryBuy();
  report.push(`day ${day}: reached night ${reachedNight(save)}, ${bought.length} bought ${bought.join(', ')}; coins left ${save.coins}, ${hourlyRate(save.buildings)}/h`);
}
console.log(report.join('\n'));
