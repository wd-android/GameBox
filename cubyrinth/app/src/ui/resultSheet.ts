import { BALLS, type BallId } from '../config/tuning';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import { cubeCode, type Cube } from '../maze/generator';
import { LEVELS, score } from '../game/levels';
import { dateKey, highestUnlocked, recordDaily, recordLevel } from '../game/progress';
import type { App } from './app';
import { h } from './dom';
import { formatTime, type PlayConfig } from './playScreen';

export interface ResultInput {
  cfg: PlayConfig;
  cube: Cube;
  ball: BallId;
  control: 'tilt' | 'step';
  seconds: number;
  falls: number;
}

/** The level-complete card: time against par, stars, score, medal, coins. */
export function showResult(app: App, r: ResultInput): void {
  const save = app.save;
  const res = score(r.cube, r.ball, r.seconds);
  const step = r.control === 'step';
  let coins = 0;
  let note = '';
  let title = 'Cube solved!';

  if (r.cfg.kind === 'journey') {
    const id = r.cfg.level!.id;
    const out = recordLevel(save, id, step ? 'step' : r.ball, { time: r.seconds, stars: step ? 0 : res.stars, falls: r.falls, score: step ? 0 : res.score });
    coins = out.coins;
    title = `Level ${id}`;
    if (out.newMedal) note = step ? 'Step medal earned' : `${BALLS[r.ball].name} medal earned`;
    else if (out.improved) note = 'New best time';
  } else if (r.cfg.kind === 'daily') {
    const out = recordDaily(save, r.cfg.date ?? dateKey(), cubeCode(r.cube.n, r.cube.seed), r.seconds);
    coins = out.coins;
    title = 'Daily Cube';
    note = `${out.best ? 'Best time today · ' : ''}Streak ${out.streak} 🔥`;
  } else {
    title = 'Explore';
    note = `Cube code ${cubeCode(r.cube.n, r.cube.seed)}`;
  }
  save.inProgress = null;
  app.persist();

  const showStars = r.cfg.kind !== 'explore' && !step;
  const starEls = [0, 1, 2].map(() => h('span', { class: 'star' }, '★'));
  const time = h('div', { class: 'big-number' }, r.cfg.kind === 'explore' ? '✓' : formatTime(r.seconds));
  const stats = h(
    'div',
    { class: 'stats' },
    r.cfg.kind !== 'explore' && !step ? stat('Par', formatTime(res.par)) : null,
    r.cfg.kind !== 'explore' && !step ? stat('Score', String(res.score)) : null,
    stat('Falls', String(r.falls)),
    coins ? stat('Coins', `+${coins}`) : null,
  );
  const actions = h('div', { class: 'result-actions' });
  const overlay = h(
    'div',
    { class: 'overlay' },
    h(
      'div',
      { class: 'sheet card result' },
      h('h2', { class: 'title' }, title),
      h('div', { class: 'medal-row' }, h('span', { class: `ball-dot big ${step ? 'step' : r.ball}` }), h('span', { class: 'subtitle' }, step ? 'Step mode' : `${BALLS[r.ball].name} ball`)),
      time,
      showStars ? h('div', { class: 'stars' }, ...starEls) : null,
      stats,
      note ? h('div', { class: 'subtitle' }, note) : null,
      actions,
    ),
  );
  const btn = (label: string, cls: string, fn: () => void) => {
    const b = h('button', { class: `btn ${cls}` }, label);
    b.addEventListener('click', () => {
      sound.tap();
      overlay.remove();
      fn();
    });
    return b;
  };
  if (r.cfg.kind === 'journey') {
    const next = r.cfg.level!.id + 1;
    if (next <= LEVELS.length && next <= highestUnlocked(save)) actions.append(btn('Next', 'primary', () => app.playLevel(next)));
    actions.append(btn('Retry', 'secondary', () => app.restart(r.cfg)));
    actions.append(btn('Journey', 'ghost', () => app.openJourney()));
  } else if (r.cfg.kind === 'daily') {
    actions.append(btn('Try again', 'primary', () => app.restart(r.cfg)), btn('Home', 'ghost', () => app.goHome()));
  } else {
    actions.append(btn('New cube', 'primary', () => app.playExplore(r.cube.n, (Math.random() * 1e6) | 0)), btn('Home', 'ghost', () => app.goHome()));
  }
  app.ui.append(overlay);

  if (showStars) {
    for (let i = 0; i < res.stars; i++)
      window.setTimeout(
        () => {
          starEls[i].classList.add('lit');
          sound.star(i);
          haptic.medium();
        },
        350 + i * 300,
      );
  }
}

function stat(label: string, value: string): HTMLElement {
  return h('div', { class: 'stat' }, h('small', {}, label), h('b', {}, value));
}
