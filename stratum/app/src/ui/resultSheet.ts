import { TUNING } from '../config/tuning';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import { applyDailyResult, applyMatchResult, highestUnlocked, type PourResult } from '../game/progress';
import { dateKey } from '../jars/jars';
import type { ShapeId } from '../jars/shapes';
import type { JarDef } from '../jars/types';
import { jarThumb } from '../render/outline';
import type { App } from './app';
import { corkIcon, h, toast, toggle } from './dom';

export interface ResultInput {
  mode: 'match' | 'daily' | 'free';
  jar: JarDef | null;
  shape: ShapeId;
  date?: string;
  cells: Uint8Array;
  result: PourResult;
  onAgain: () => void;
}

/**
 * Result (§10): the jar is corked and turns once, accuracy counts up, stars
 * fill one by one, corks are added. Next, Pour again, Shelf.
 */
export function showResult(app: App, r: ResultInput): void {
  const save = app.save;
  const { acc, stars, freehand } = r.result;
  let earned = 0;
  let note = '';
  let keepRow: HTMLElement | null = null;

  if (r.mode === 'match' && r.jar) {
    const prev = save.jars[r.jar.id];
    const prevKept = prev?.kept ?? '';
    const keepNew = !prev || acc >= prev.best;
    const out = applyMatchResult(save, r.jar.id, r.result, keepNew);
    earned = out.earned;
    if (out.setCompleted) window.setTimeout(() => toast(`${out.setCompleted!.decoration} ${out.setCompleted!.name} set complete! +${TUNING.CORKS_SET_COMPLETE}`, 2600), 2200);
    if (stars === 0) note = 'Almost! 70% unlocks the next jar.';
    if (prevKept) {
      keepRow = h(
        'div',
        { class: 'row', style: 'width:100%' },
        h('span', {}, 'Keep this pour on the shelf'),
        toggle(keepNew, (v) => {
          save.jars[r.jar!.id].kept = v ? r.result.grid : prevKept;
          app.persist();
        }),
      );
    }
    save.firstLaunchDone = true;
  } else if (r.mode === 'daily' && r.jar) {
    const out = applyDailyResult(save, r.date ?? dateKey(), r.jar.id, r.result);
    earned = out.earned;
    note = `Streak: ${out.streak} day${out.streak === 1 ? '' : 's'} 🔥`;
  }
  app.persist();

  const thumbW = Math.min(150, window.innerWidth * 0.36);
  const jarCanvas = jarThumb(r.shape, r.cells, thumbW, { patterns: save.settings.patterns, cork: true });
  const spin = h('div', { class: 'jar-spin' }, h('div', { class: 'cork-drop' }, jarCanvas));

  const pct = h('div', { class: 'big-number' }, r.mode === 'free' ? '' : '0%');
  const starEls = [0, 1, 2].map(() => h('span', { class: 'star' }, '★'));
  const starRow = r.mode === 'free' ? null : h('div', { class: 'stars' }, ...starEls);
  const corkLine = h('div', { class: 'chip', style: 'opacity:0' }, h('span', { html: corkIcon() }), `+${earned}`);

  const title =
    r.mode === 'free' ? 'Free Pour' : r.mode === 'daily' ? 'Daily Jar' : `${r.jar?.title ?? ''}`;
  const heading = h('h2', { class: 'title', style: 'font-size:26px' }, title, freehand ? h('span', { class: 'freehand' }, 'FREEHAND') : null);

  const actions = h('div', { class: 'result-actions' });
  const sheet = h('div', { class: 'sheet card result' }, heading, spin, pct, starRow, corkLine, note ? h('div', { class: 'subtitle' }, note) : null, keepRow, actions);
  const overlay = h('div', { class: 'overlay' }, sheet);

  const close = () => overlay.remove();
  const btn = (label: string, cls: string, fn: () => void) => {
    const b = h('button', { class: `btn ${cls}` }, label);
    b.addEventListener('click', () => {
      sound.tap();
      close();
      fn();
    });
    return b;
  };

  if (r.mode === 'match' && r.jar) {
    const next = r.jar.id + 1;
    if (next <= TUNING.MATCH_JAR_COUNT && next <= highestUnlocked(save)) actions.append(btn('Next', 'primary', () => app.playMatch(next)));
    actions.append(btn('Pour again', 'secondary', r.onAgain));
    actions.append(btn('Shelf', 'ghost', () => app.goHome()));
  } else if (r.mode === 'free') {
    const full = save.free.length >= TUNING.FREE_POUR_KEEP_MAX;
    const keep = h('button', { class: 'btn primary' }, full ? 'Shelf full' : 'Keep on shelf');
    if (full) keep.setAttribute('disabled', '');
    keep.addEventListener('click', () => {
      save.free.push({ shape: r.shape, grid: r.result.grid, made: new Date().toISOString() });
      app.persist();
      close();
      sound.pop();
      app.goHome();
    });
    actions.append(keep, btn('Pour again', 'secondary', r.onAgain), btn('Shelf', 'ghost', () => app.goHome()));
  } else {
    actions.append(btn('Shelf', 'primary', () => app.goHome()));
  }

  app.ui.append(overlay);

  // Animation sequence: cork pop, count-up, stars.
  window.setTimeout(() => {
    sound.pop();
    haptic.firm();
  }, 150);
  if (r.mode === 'free') {
    corkLine.style.opacity = earned ? '1' : '0';
    return;
  }
  const reduce = save.settings.reduceMotion;
  const t0 = performance.now() + (reduce ? 0 : 500);
  const dur = reduce ? 1 : 900;
  const tick = () => {
    const k = Math.max(0, Math.min(1, (performance.now() - t0) / dur));
    pct.textContent = `${Math.round(acc * 100 * (1 - Math.pow(1 - k, 3)))}%`;
    if (k < 1) requestAnimationFrame(tick);
    else lightStars();
  };
  requestAnimationFrame(tick);
  function lightStars() {
    for (let i = 0; i < stars; i++) {
      window.setTimeout(() => {
        starEls[i].classList.add('lit');
        sound.star(i);
        haptic.medium();
      }, i * 320);
    }
    window.setTimeout(() => {
      corkLine.style.opacity = '1';
      corkLine.style.transition = 'opacity .3s';
      if (stars === 3) sound.fanfare();
    }, stars * 320 + 100);
  }
}
