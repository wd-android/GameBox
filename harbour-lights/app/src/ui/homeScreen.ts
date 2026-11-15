import { TownView } from '../render/townView';
import { activeRequest, allDone, collectEarnings, reachedNight, settle, totalStars } from '../game/progress';
import { hourlyRate, storeCap } from '../town/town';
import { NIGHT_COUNT } from '../nights/nights';
import { APP } from '../config/app';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import type { App, Screen } from './app';
import { h, ICONS, iconButton, toast } from './dom';
import { openBuildings, openLighthouse, openNights, openSettings } from './sheets';
import { coinIcon } from './nightScreen';

/** Home is the town (§10): lit windows, collect, Next night, Buildings, Lighthouse, Settings, coins. */
export class HomeScreen implements Screen {
  el: HTMLElement;
  private view: TownView;
  private coinsEl = h('span', {}, '0');
  private collectBtn!: HTMLButtonElement;
  private storeFill!: HTMLElement;
  private requestEl = h('div', {});
  private timer = 0;
  private onFrame = () => this.view.render(this.app.pixi.ticker.deltaMS / 1000);
  private onResize = () => this.view.layout(window.innerWidth, window.innerHeight);

  constructor(private app: App) {
    this.view = new TownView(app.save.buildings);
    this.view.reducedMotion = app.save.settings.reduceMotion;
    this.view.layout(window.innerWidth, window.innerHeight);
    app.pixi.stage.addChild(this.view.root);
    app.pixi.ticker.add(this.onFrame);
    app.pixi.ticker.start();
    window.addEventListener('resize', this.onResize);
    this.el = this.build();
    this.refresh();
    this.timer = window.setInterval(() => this.refresh(), 1000);
  }

  private build(): HTMLElement {
    const save = this.app.save;
    const n = reachedNight(save);
    this.collectBtn = h('button', { class: 'collect hit' });
    this.storeFill = h('span', { class: 'store-fill' });
    this.collectBtn.append(h('span', { class: 'store-track' }, this.storeFill), h('span', { class: 'collect-text' }));
    this.collectBtn.addEventListener('click', () => this.collect());
    const next = h('button', { class: 'btn primary wide next' }, allDone(save) ? 'Replay a night' : `Night ${n}`, h('small', {}, n > 20 ? 'The Skerries' : 'Home Bay'));
    next.addEventListener('click', () => {
      sound.unlock();
      sound.tap();
      if (allDone(save)) openNights(this.app);
      else this.app.playNight(n);
    });
    const btn = (label: string, fn: () => void) => {
      const b = h('button', { class: 'btn secondary' }, label);
      b.addEventListener('click', () => {
        sound.unlock();
        sound.tap();
        fn();
      });
      return b;
    };
    return h(
      'div',
      { class: 'screen home passthrough' },
      h(
        'div',
        { class: 'topbar hit' },
        h('div', { class: 'chip coins-chip' }, coinIcon(), this.coinsEl),
        h('div', { class: 'chip' }, `★ ${totalStars(save)}`),
        h('div', { class: 'spacer' }),
        iconButton(ICONS.gear, 'Settings', () => openSettings(this.app)),
      ),
      h('h1', { class: 'title home-title' }, APP.DISPLAY_NAME),
      h('div', { class: 'spacer-flex' }),
      this.collectBtn,
      this.requestEl,
      h('div', { class: 'home-actions hit' }, next, h('div', { class: 'three' }, btn('Buildings', () => openBuildings(this.app, () => this.view.setLevels(save.buildings))), btn('Lighthouse', () => openLighthouse(this.app)), btn('Nights', () => openNights(this.app)))),
    );
  }

  private collect(): void {
    sound.unlock();
    const coins = collectEarnings(this.app.save);
    if (coins > 0) {
      sound.coin();
      haptic.tick();
      toast(`+${coins} coins from the town`);
      this.app.persist();
    } else toast('Nothing to collect yet');
    this.refresh();
  }

  private refresh(): void {
    const save = this.app.save;
    settle(save);
    this.coinsEl.textContent = String(save.coins);
    const rate = hourlyRate(save.buildings);
    const cap = storeCap(save.buildings);
    const stored = Math.floor(save.store.stored);
    this.storeFill.style.width = `${cap ? (100 * save.store.stored) / cap : 0}%`;
    this.collectBtn.querySelector('.collect-text')!.textContent = rate ? `Collect ${stored} · ${rate}/h${stored >= Math.floor(cap) ? ' · full' : ''}` : 'The fish market opens after your first catch';
    this.collectBtn.classList.toggle('full', stored >= Math.floor(cap) && cap > 0);
    const req = activeRequest(save);
    this.requestEl.replaceChildren();
    if (req) {
      this.requestEl.className = 'request-card hit';
      this.requestEl.append(h('small', {}, `${req.request.who} asks:`), h('b', {}, req.request.text), h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: `width:${(100 * req.progress) / req.request.target}%` })), h('span', { class: 'subtitle' }, `${req.progress} of ${req.request.target} · reward ${req.request.reward} coins`));
    } else this.requestEl.className = '';
    if (reachedNight(save) === NIGHT_COUNT && allDone(save)) this.el?.classList.add('all-done');
  }

  destroy(): void {
    window.clearInterval(this.timer);
    this.app.pixi.ticker.remove(this.onFrame);
    window.removeEventListener('resize', this.onResize);
    this.view.destroy();
    this.el.remove();
  }
}
