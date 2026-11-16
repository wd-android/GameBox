import { useCallback, useEffect, useRef, useState } from 'react';
import type { MomentDef, MomentState, SimEvent } from '../../sim/types';
import { applyInput, createMoment, step } from '../../sim/moment';
import { SCREEN, TUNING } from '../../config/tuning';
import { SceneRenderer } from '../scene/sceneRenderer';
import { EffectsRenderer } from '../effects/effects';
import { Narrator } from '../narrator';
import { TEACH } from '../../content/lines';
import { sound } from '../../audio/sound';
import { haptics } from '../../audio/haptics';
import { scoreMoment } from '../../game/scoring';
import { choreFraction } from '../../sim/chores';
import { Icon } from './icons';
import type { MomentOptions } from '../../sim/moment';

interface Props {
  def: MomentDef;
  options: MomentOptions;
  reduceMotion: boolean;
  moodHints: boolean;
  onFinish: (s: MomentState) => void;
  onQuit: () => void;
  onSettings: () => void;
  pausedExternally: boolean;
}

export function objectiveText(def: MomentDef): string {
  const o = def.objective;
  switch (o.kind) {
    case 'finishChore': return def.chore === 'hoover' ? 'Hoover' : { coffee: 'Make the coffee', email: 'Write the email', washing: 'Fold the washing', tidy: 'Tidy the table' }[def.chore ?? 'coffee'] ?? 'Finish the chore';
    case 'serve': return `Give him what he wants (${o.n})`;
    case 'content': return `Keep him purring (${o.seconds} s)`;
    case 'survive': return 'Get through it';
    case 'boss': return def.difficulty?.id === 'hoover' ? `Hoover ${def.hooverAreas ?? 1} area${(def.hooverAreas ?? 1) > 1 ? 's' : ''}` : 'Tidy up, guest unbitten';
  }
}

function progressText(s: MomentState): string {
  const o = s.def.objective;
  switch (o.kind) {
    case 'finishChore': case 'boss': return `${Math.round(choreFraction(s.chore) * 100)}%`;
    case 'serve': return `${Math.min(o.n, s.tally.met)}/${o.n}`;
    case 'content': return `${Math.min(o.seconds, Math.floor(s.tally.contentSecs))}/${o.seconds}s`;
    case 'survive': return '';
  }
}

export function MomentScreen({ def, options, reduceMotion, moodHints, onFinish, onQuit, onSettings, pausedExternally }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<MomentState | null>(null);
  const sceneR = useRef<SceneRenderer | null>(null);
  const fxR = useRef<EffectsRenderer | null>(null);
  const narr = useRef(new Narrator());
  const geo = useRef({ k: 1, ox: 0, oy: 0 });
  const pointer = useRef<number | null>(null);
  const finished = useRef(false);
  const lastMood = useRef<string>('');
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [, setFrame] = useState(0);
  const [border, setBorder] = useState(false);
  pausedRef.current = paused || pausedExternally;

  useEffect(() => {
    finished.current = false;
    simRef.current = createMoment(def, options);
    if (import.meta.env.DEV) (window as unknown as { __sim: unknown }).__sim = simRef.current;
    narr.current = new Narrator();
    const teach = def.teach && TEACH[def.teach];
    if (teach) narr.current.teach(teach, 0, 6);
    else narr.current.say('start', 0, true);
    if (def.teach === 'feed') narr.current.teach(TEACH.feed, 0, 8);
    sound.musicStart();
    return () => { sound.stopLayers(); haptics.rumble(null); };
  }, [def, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Layout: the 390 × 800 design space, scaled to fit and centred
  useEffect(() => {
    sceneR.current = new SceneRenderer(sceneRef.current!);
    fxR.current = new EffectsRenderer(fxRef.current!);
    const fit = () => {
      const el = rootRef.current!;
      const W = el.clientWidth, H = el.clientHeight;
      const k = Math.min(W / SCREEN.w, H / SCREEN.h);
      const ox = (W - SCREEN.w * k) / 2, oy = (H - SCREEN.h * k) / 2;
      geo.current = { k, ox, oy };
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      sceneR.current!.resize(SCREEN.w * k, SCREEN.h * k, dpr);
      fxR.current!.resize(W, H, dpr, k, ox, oy);
      const stage = el.querySelector('.stage2') as HTMLElement;
      stage.style.left = `${ox}px`; stage.style.top = `${oy}px`;
      stage.style.width = `${SCREEN.w * k}px`; stage.style.height = `${SCREEN.h * k}px`;
      stage.style.setProperty('--k', String(k));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(rootRef.current!);
    return () => ro.disconnect();
  }, []);

  const handleEvent = useCallback((s: MomentState, e: SimEvent) => {
    const n = narr.current;
    const t = s.time;
    sceneR.current?.onEvent(s, e);
    switch (e.type) {
      case 'met':
        sound.play('chirp'); haptics.pulse();
        if (e.kind === 'food') n.say((e.value ?? 0) > 10 ? 'fedLate' : 'fed', t, true);
        else n.say(e.kind ?? 'fed', t, true);
        break;
      case 'wrong': sound.play('mrrp'); haptics.double(); n.say('wrong', t, true); break;
      case 'swipeWindup': case 'biteWindup': break;
      case 'swipe':
        sound.play('rip'); haptics.sharp();
        n.say(e.value ? 'swipe' : 'swipeMissed', t, true);
        if (reduceMotion) { setBorder(true); window.setTimeout(() => setBorder(false), 300); }
        break;
      case 'bite': sound.play('crunch'); haptics.firm(); n.say(e.kind === 'belly' ? 'bellyBite' : 'bite', t, true); break;
      case 'snap': n.say('snap', t, true); break;
      case 'plaster': sound.play('peel'); haptics.tick(); break;
      case 'scream': if (Math.random() < 0.4) n.say('scream', t); break;
      case 'knocked': sound.play('crash', 1); haptics.tick(); n.say('knocked', t); break;
      case 'uiKnocked': sound.play('clatter'); haptics.tick(); n.say('uiKnocked', t, true); break;
      case 'ladder': if (e.kind === 'sitOn') n.say('sitOn', t); if (e.kind === 'closeStare') n.say('closeStare', t, true); break;
      case 'challenge': n.say('challenge', t, true); break;
      case 'brainPresent': sound.play('ding'); haptics.tick(); break;
      case 'lapse': sound.play(Math.random() < 0.5 ? 'bonk' : 'slide'); haptics.double(); break;
      case 'lapseSeen': n.say('lapseSeen', t, true); break;
      case 'headButt': sound.play('thud'); haptics.pulse(); n.say('headButt', t); break;
      case 'blinkAnswered': n.say('blink', t); break;
      case 'choreStep': sound.play('click'); haptics.tick(); break;
      case 'lifted': n.say('lifted', t, true); break;
      case 'treat': n.say('treat', t); break;
      case 'schemeDone': sound.play('fanfare'); n.say('schemeDone', t, true); break;
      case 'schemeStopped': n.say('schemeStopped', t, true); break;
      case 'guestHit': sound.play('rip'); n.say('guestHit', t, true); break;
      case 'guestPushed': n.say('guestPushed', t); break;
      case 'hooverHit': sound.play('rip'); n.say('hooverHit', t, true); break;
      case 'door': sound.play('door'); break;
      case 'pouchEmptied': sound.play('pour'); break;
      case 'objectiveMet': sound.play('chime'); n.say('objective', t, true); break;
      case 'mood':
        if (e.kind === 'tolerating' && lastMood.current === 'content' && s.hand.down && s.hand.over.kind === 'cat') n.say('overstepped', t);
        lastMood.current = e.kind ?? '';
        break;
      case 'end':
        if (s.endReason === 'plasters') n.say('plastersOut', t, true);
        sound.play(s.status === 'won' ? 'win' : 'fail');
        break;
      default:
    }
  }, [reduceMotion]);

  // Main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let vis = 0;
    let screaming = false;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const s = simRef.current;
      if (!s || !sceneR.current || !fxR.current) return;
      let dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (pausedRef.current) dt = 0;
      acc += dt;
      while (acc >= TUNING.dt && s.status === 'running') {
        acc -= TUNING.dt;
        step(s);
        for (const e of s.events.splice(0)) handleEvent(s, e);
      }
      for (const e of s.events.splice(0)) handleEvent(s, e);
      vis += dt;
      // Audio and haptics read only the body-language display
      const d = s.cat.display;
      const live = dt > 0 && s.status === 'running' && s.cat.onScreen;
      sound.setPurr(live && d.sound === 'purr' ? 0.65 : 0);
      sound.setGrowl(live && d.sound === 'growl' ? 0.8 : 0);
      sound.setHoover(live && !!s.chore?.hoover?.running);
      const sc = live && d.sound === 'scream';
      if (sc && !screaming) { sound.screamStart(); haptics.rumble('scream'); }
      if (!sc && screaming) { sound.screamStop(); haptics.rumble(null); }
      screaming = sc;
      if (!sc) haptics.rumble(live && d.rumble === 'purr' ? 'purr' : live && d.rumble === 'tremor' ? 'purr' : null);
      if (live && d.sound === 'chirp' && Math.random() < dt / 3) sound.play('chirp');
      sceneR.current.draw(s, vis, dt, reduceMotion);
      const st = s.cat.strike;
      fxR.current.draw(s.time, s.marks, s.wash, st && st.phase === 'strike' ? { path: st.path, t: 1 - st.t / TUNING.strike.swipeStrike } : null);
      // Scream shake, applied to the scene and the interface together (never with Reduce motion)
      const stage = rootRef.current?.querySelector('.stage2') as HTMLElement | null;
      if (stage) {
        const shaking = s.time < s.shakeUntil && !reduceMotion && dt > 0;
        stage.style.transform = shaking ? `translate(${(Math.random() - 0.5) * TUNING.shakeMax * 2 * geo.current.k}px, ${(Math.random() - 0.5) * TUNING.shakeMax * geo.current.k}px)` : '';
      }
      setFrame((f) => (f + 1) % 1e6);
      if (s.status !== 'running' && !finished.current) {
        finished.current = true;
        sound.stopLayers(); haptics.rumble(null);
        window.setTimeout(() => onFinish(s), 1500);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [handleEvent, onFinish, reduceMotion, attempt]);

  useEffect(() => {
    if (pausedRef.current) { sound.stopLayers(); haptics.rumble(null); sound.suspend(); } else sound.resume();
  }, [paused, pausedExternally]);

  // Touch: only the first finger is used (§5.2)
  const toDesign = (e: React.PointerEvent) => {
    const r = rootRef.current!.getBoundingClientRect();
    const { k, ox, oy } = geo.current;
    return { x: (e.clientX - r.left - ox) / k, y: (e.clientY - r.top - oy) / k };
  };
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (pointer.current !== null || pausedRef.current) return;
    sound.ensure();
    pointer.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = toDesign(e);
    if (simRef.current) applyInput(simRef.current, { type: 'hand', down: true, ...p });
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerId !== pointer.current || !simRef.current) return;
    applyInput(simRef.current, { type: 'hand', down: true, ...toDesign(e) });
  };
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerId !== pointer.current) return;
    pointer.current = null;
    if (simRef.current) applyInput(simRef.current, { type: 'hand', down: false, ...toDesign(e) });
  };

  const s = simRef.current;
  const now = s ? s.time < s.nowUntil : false;
  const L = (txt: string) => (now ? 'NOW' : txt);
  const cap = s ? narr.current.text(s.time) : null;
  const timeLeft = s ? Math.max(0, Math.ceil(s.length - s.time)) : def.length;
  const pauseSatOn = !!s && s.cat.sitOn?.what === 'pause' && s.cat.activity === 'demanding';
  const score = s ? scoreMoment(s).total : 0;
  const left = options.settings.leftHanded;

  return (
    <div className="moment" ref={rootRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <div className="stage2">
        <canvas ref={sceneRef} className="scene" aria-label={`${def.title}. ${objectiveText(def)}.`} />
        <div className={`strip ${left ? 'left' : ''}`}>
          <button className="icon-btn" aria-label={pauseSatOn ? 'He is sitting on the pause button' : 'Pause'} disabled={pauseSatOn} onClick={() => { if (!pauseSatOn) { setPaused(true); sound.play('ui'); } }}>
            {pauseSatOn ? <Icon name="cat" /> : <Icon name="pause" />}
          </button>
          <div className="objective">
            <div className="t">{L(objectiveText(def))}</div>
            <div className="s">{L(`${s ? progressText(s) : ''}${s?.objectiveMet ? ' ✓' : ''}`)}</div>
          </div>
          {!s?.ui.score && <div className="pill" aria-label={`Score ${score}`}>{L(String(score))}</div>}
          <div className={`timer ${timeLeft <= 10 ? 'low' : ''}`}>{L(String(timeLeft))}</div>
        </div>
        {s && s.def.systems.plasters && !s.ui.plasters && (
          <div className={`plasters ${left ? 'left' : ''}`} aria-label={`${s.plasters} plasters left`}>
            {Array.from({ length: s.plastersStart }, (_, i) => <span key={i} className={`plaster ${i < s.plasters ? '' : 'used'}`}>{now ? 'NOW' : ''}</span>)}
          </div>
        )}
        {moodHints && s && <MoodHint s={s} />}
        <div className={`caption2 ${cap?.teach ? 'teach' : ''} ${cap ? '' : 'blank'}`} aria-live="polite">{cap ? (cap.teach ? cap.text : `“${cap.text}”`) : ' '}</div>
        {s && (s.ui.score || s.ui.plasters) && (
          <div className="fallen">
            {s.ui.score && <button className="fallen-item" style={{ transform: 'rotate(-14deg)' }} onClick={() => applyInput(s, { type: 'restore', id: 'score' })}>{score}</button>}
            {s.ui.plasters && <button className="fallen-item" style={{ transform: 'rotate(9deg)' }} onClick={() => applyInput(s, { type: 'restore', id: 'plasters' })}>▭▭▭</button>}
          </div>
        )}
      </div>
      <canvas ref={fxRef} className="fx" aria-hidden="true" />
      <div className={`border-flash ${border ? 'on' : ''}`} />
      {paused && (
        <div className="overlay">
          <div className="card col" style={{ gap: 12 }}>
            <h2>Paused</h2>
            <p className="dim small" style={{ margin: 0 }}>{def.title}. {objectiveText(def)}.</p>
            <button className="btn" onClick={() => setPaused(false)}>Resume</button>
            <button className="btn secondary" onClick={() => { setPaused(false); setAttempt((a) => a + 1); }}>Restart</button>
            <button className="btn secondary" onClick={onSettings}>Settings</button>
            <button className="btn secondary" onClick={() => { sound.stopLayers(); onQuit(); }}>Leave</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Optional "Mood hints" gauge (§16): shows attention and the band, for players who find him hard to read */
function MoodHint({ s }: { s: MomentState }) {
  const b = s.band;
  return (
    <div className="moodhint" aria-label="Mood hint">
      <div className="zone" style={{ left: `${b.centre - b.halfWidth}%`, width: `${b.halfWidth * 2}%` }} />
      <div className="mark" style={{ left: `${s.cat.attention}%` }} />
      <div className="irr" style={{ width: `${s.cat.irritation}%` }} />
    </div>
  );
}
