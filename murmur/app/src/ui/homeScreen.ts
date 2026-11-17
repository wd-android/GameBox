import { App as CapApp } from '@capacitor/app';
import { APP } from '../config/app';
import { SPECIES, SPECIES_ORDER, TUNING } from '../config/tuning';
import { sound } from '../audio/sound';
import { SKIES, rank, skyUnlocked, speciesUnlocked } from '../game/progress';
import { MISSIONS, activeMissions, describe as describeMission, progress } from '../game/missions';
import { freshSave, type Steering } from '../state/save';
import type { App, Screen } from './app';
import { h, ICONS, iconButton, segmented, toggle } from './dom';

/** Home (§9): Fly, Species, Skies, Missions, Settings; best score, feathers and rank. */
export class HomeScreen implements Screen {
  el: HTMLElement;

  constructor(private app: App) {
    const save = app.save;
    const top = h(
      'div',
      { class: 'topbar' },
      h('div', { class: 'chip', 'aria-label': `${save.feathers} feathers` }, '🪶', String(save.feathers)),
      h('div', { class: 'chip', 'aria-label': `Rank ${rank(save)}` }, '★', `Rank ${rank(save)}`),
      h('div', { class: 'spacer' }),
      iconButton(ICONS.gear, 'Settings', () => this.openSettings()),
    );
    const fly = h('button', { class: 'btn primary fly-btn' }, 'Fly');
    fly.addEventListener('click', () => {
      sound.unlock();
      sound.tap();
      app.fly();
    });
    const tile = (title: string, sub: string, fn: () => void) => {
      const b = h('button', { class: 'tile' }, title, h('small', {}, sub));
      b.addEventListener('click', () => {
        sound.unlock();
        sound.tap();
        fn();
      });
      return b;
    };
    this.el = h(
      'div',
      { class: 'screen home' },
      top,
      h('div', { class: 'hero' }, h('div', { class: 'hero-art', html: flockArt() }), h('h1', { class: 'title hero-title' }, APP.DISPLAY_NAME), h('div', { class: 'subtitle' }, `Best ${save.best} · ${SPECIES[save.species].name}`)),
      h(
        'div',
        { class: 'home-actions' },
        fly,
        tile('Species', SPECIES[save.species].name, () => this.openSpecies()),
        tile('Skies', (SKIES.find((s) => s.id === save.sky) ?? SKIES[0]).name, () => this.openSkies()),
        tile('Missions', `${save.completed.length}/${MISSIONS.length} done`, () => this.openMissions()),
        tile('Settings', save.settings.steering === 'thumb' ? 'Follow my thumb' : 'Draw a path', () => this.openSettings()),
      ),
    );
  }

  private sheet(...content: (HTMLElement | null)[]): HTMLElement {
    const overlay = h('div', { class: 'overlay' });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    const done = h('button', { class: 'btn primary wide' }, 'Done');
    done.addEventListener('click', () => {
      overlay.remove();
      this.app.goHome();
    });
    // Android back button: the same as Done, so the tiles show the new choice.
    overlay.addEventListener('back', (e) => {
      e.preventDefault();
      overlay.remove();
      this.app.goHome();
    });
    overlay.append(h('div', { class: 'sheet card' }, ...content, done));
    this.app.ui.append(overlay);
    return overlay;
  }

  private openSpecies(): void {
    const save = this.app.save;
    const list = h('div', { class: 'choice-list' });
    for (const id of SPECIES_ORDER) {
      const sp = SPECIES[id];
      const open = speciesUnlocked(save, id);
      const b = h(
        'button',
        { class: `choice${save.species === id ? ' selected' : ''}${open ? '' : ' locked'}` },
        h('span', { class: 'species-icon', html: speciesIcon(id) }),
        h('span', { class: 'choice-text' }, h('b', {}, sp.name), h('small', {}, open ? `Speed ${sp.leaderSpeed} · ${sp.pointsPerBird} pts/bird · best ${save.bestBySpecies[id] ?? 0}` : `Gather ${sp.unlockGathered.toLocaleString('en-GB')} birds in total (${save.totalGathered} so far)`)),
      );
      b.addEventListener('click', () => {
        if (!open) return;
        save.species = id;
        this.app.persist();
        list.querySelectorAll('.choice').forEach((c) => c.classList.remove('selected'));
        b.classList.add('selected');
      });
      list.append(b);
    }
    this.sheet(h('h2', { class: 'title', style: 'text-align:center' }, 'Species'), h('div', { class: 'subtitle', style: 'text-align:center' }, 'Swallows are quick and narrow; geese fly in a wide V and score more per bird.'), list);
  }

  private openSkies(): void {
    const save = this.app.save;
    const list = h('div', { class: 'choice-list' });
    for (const sky of SKIES) {
      const open = skyUnlocked(save, sky.id);
      const b = h(
        'button',
        { class: `choice${save.sky === sky.id ? ' selected' : ''}${open ? '' : ' locked'}` },
        h('span', { class: 'swatch-sq', style: `background:linear-gradient(0deg,${sky.stops.join(',')})` }),
        h('span', { class: 'choice-text' }, h('b', {}, sky.name), h('small', {}, open ? 'Open' : `Reach rank ${sky.rank} (every ${TUNING.MISSIONS_PER_RANK} missions)`)),
      );
      b.addEventListener('click', () => {
        if (!open) return;
        save.sky = sky.id;
        this.app.persist();
        list.querySelectorAll('.choice').forEach((c) => c.classList.remove('selected'));
        b.classList.add('selected');
      });
      list.append(b);
    }
    this.sheet(h('h2', { class: 'title', style: 'text-align:center' }, 'Skies'), list);
  }

  private openMissions(): void {
    const save = this.app.save;
    const list = h('div', { class: 'missions' });
    for (const m of activeMissions(save.completed)) {
      const p = m.kind === 'gather' ? Math.min(m.goal, progress(m, null, save.totalGathered)) : 0;
      list.append(
        h(
          'div',
          { class: 'mission' },
          h('span', {}, describeMission(m)),
          h('div', { class: 'bar' }, h('div', { style: `width:${(p / m.goal) * 100}%` })),
          h('small', {}, `+${m.reward} 🪶${m.kind === 'gather' ? ` · ${p}/${m.goal}` : ''}`),
        ),
      );
    }
    const next = (TUNING.MISSIONS_PER_RANK - (save.completed.length % TUNING.MISSIONS_PER_RANK)) % TUNING.MISSIONS_PER_RANK || TUNING.MISSIONS_PER_RANK;
    this.sheet(
      h('h2', { class: 'title', style: 'text-align:center' }, 'Missions'),
      h('div', { class: 'subtitle', style: 'text-align:center' }, `Rank ${rank(save)} · ${next} more to the next rank`),
      list,
    );
  }

  private openSettings(): void {
    const app = this.app;
    const s = app.save.settings;
    const save = () => {
      app.applySettings();
      app.persist();
    };
    const reset = h('button', { class: 'btn ghost' }, 'Reset progress');
    reset.addEventListener('click', () => {
      if (reset.dataset.confirm) {
        const keep = app.save.settings;
        app.save = freshSave();
        app.save.settings = keep;
        app.save.firstLaunchDone = true;
        app.persist();
        app.goHome();
        return;
      }
      reset.dataset.confirm = '1';
      reset.textContent = 'Tap again to erase everything';
      reset.style.borderColor = '#ff5454';
    });
    this.sheet(
      h('h2', { class: 'title', style: 'text-align:center' }, 'Settings'),
      h(
        'div',
        { class: 'row' },
        h('span', {}, 'Steering', h('small', {}, 'From the next run')),
        segmented<Steering>(
          [
            ['thumb', 'Follow thumb'],
            ['draw', 'Draw a path'],
          ],
          s.steering,
          (v) => ((s.steering = v), save()),
        ),
      ),
      h('div', { class: 'row' }, h('span', {}, 'Music'), toggle(s.music, (v) => ((s.music = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Sound effects'), toggle(s.sfx, (v) => ((s.sfx = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Vibration'), toggle(s.vibration, (v) => ((s.vibration = v), save()))),
      h('div', { class: 'row' }, h('span', {}, 'Reduce motion'), toggle(s.reduceMotion, (v) => ((s.reduceMotion = v), save()))),
      reset,
      h('div', { class: 'subtitle', style: 'text-align:center;font-size:11px' }, `${APP.DISPLAY_NAME} · v${APP.VERSION} · nothing leaves this device`),
    );
  }

  /** Android back button on Home: leave the app. */
  back(): void {
    void CapApp.minimizeApp().catch(() => {});
  }

  destroy(): void {
    this.el.remove();
  }
}

function speciesIcon(id: string): string {
  const bird = (x: number, y: number, s: number) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-9 2-3 14 1 3 1 1 9 0 7-1 9-3 1-14 1-2-3Z" fill="#1b043b"/>`;
  const body = id === 'geese' ? bird(20, 10, 0.8) + bird(11, 20, 0.7) + bird(29, 20, 0.7) : id === 'swallows' ? bird(20, 12, 0.9) + bird(20, 26, 0.7) : bird(14, 12, 0.7) + bird(26, 16, 0.7) + bird(18, 26, 0.7);
  return `<svg viewBox="0 0 40 36" width="40" height="36" aria-hidden="true"><rect width="40" height="36" rx="10" fill="#ffb35a"/>${body}</svg>`;
}

function flockArt(): string {
  let s = '<svg viewBox="0 0 240 120" width="240" height="120" aria-hidden="true">';
  for (let i = 0; i < 42; i++) {
    const t = i / 41;
    const x = 20 + t * 200 + Math.sin(t * 9) * 8;
    const y = 90 - Math.sin(t * Math.PI) * 60 + Math.cos(i * 1.7) * 6;
    const sc = 0.35 + 0.25 * Math.sin(i);
    s += `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(-40 + t * 80).toFixed(0)}) scale(${sc.toFixed(2)})" d="M0-9 2-3 14 1 3 1 1 9 0 7-1 9-3 1-14 1-2-3Z" fill="#f1ecff"/>`;
  }
  return s + '</svg>';
}
