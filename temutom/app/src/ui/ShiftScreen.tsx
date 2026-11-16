import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShiftDef, ShiftState, SimEvent, TargetRef, Verb } from '../sim/types';
import { applyInput, createShift, schemeAvailable, schemeHere, step } from '../sim/shift';
import { verbsFor, canAct } from '../sim/verbs';
import { TUNING } from '../config/tuning';
import { RoomRenderer } from './renderer';
import { Narrator } from './narrator';
import { TEACH } from '../content/lines';
import { STAFF, DOG } from '../content/staff';
import { sound } from '../audio/sound';
import { haptics } from '../audio/haptics';
import { Icon, MarkerHead } from './icons';
import type { SaveData } from '../state/save';
import { hooverData } from '../sim/threats/hoover';
import { dogData } from '../sim/threats/dog';
import { moraleLevel } from '../sim/morale';
import { ROOMS } from '../content/rooms';

interface Props {
  def: ShiftDef;
  save: SaveData;
  reduceMotion: boolean;
  onFinish: (s: ShiftState) => void;
  onQuit: () => void;
  onSettings: () => void;
  pausedExternally: boolean;
}

const VERB_LABEL: Record<Verb, string> = { scream: 'Scream', stare: 'Stare', smack: 'Smack', sitOn: 'Sit On', knockOff: 'Knock Off' };

export function objectiveText(def: ShiftDef): string {
  const o = def.objective;
  switch (o.kind) {
    case 'serve': return `Get served ${o.n} time${o.n > 1 ? 's' : ''}`;
    case 'claim': return `Claim ${ROOMS[def.room].throneName.toLowerCase()}`;
    case 'train': return `Train ${STAFF[o.staff].name}: ${o.demand} to ${o.level}`;
    case 'endure': return 'Survive the shift';
    case 'boss':
      if (def.threat?.id === 'hoover') return 'Stop the Hoover finishing';
      if (def.threat?.id === 'dog') return `Claim the armchair; keep ${DOG.name} from becoming favourite`;
      return 'Convert Clive: Lap 60, then sit on him';
  }
}

function objectiveProgress(s: ShiftState): string {
  const o = s.def.objective;
  switch (o.kind) {
    case 'serve': return `${Math.min(s.tally.met, o.n)} / ${o.n}`;
    case 'claim': return `${Math.min(12, Math.floor(s.throne.progress))} / 12 s`;
    case 'train': { const m = s.staff.find((x) => x.id === o.staff); return `${Math.floor(m?.compliance[o.demand] ?? 0)} / ${o.level}`; }
    case 'endure': return `Morale ${Math.round(s.morale)}`;
    case 'boss': return '';
  }
}

export function ShiftScreen({ def, save, reduceMotion, onFinish, onQuit, onSettings, pausedExternally }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<ShiftState | null>(null);
  const rendRef = useRef<RoomRenderer | null>(null);
  const narrRef = useRef(new Narrator());
  const selRef = useRef<TargetRef | null>(null);
  const tapRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const belowRef = useRef(0);
  const finishedRef = useRef(false);
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [flash, setFlash] = useState(false);
  const [selected, setSelected] = useState<TargetRef | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pausedRef = useRef(false);
  pausedRef.current = paused || pausedExternally;

  // Create the shift
  useEffect(() => {
    finishedRef.current = false;
    simRef.current = createShift(def, {
      compliance: save.compliance, morale: save.morale, thronesClaimed: save.thrones,
      settings: { fewerLapses: save.settings.fewerLapses, longerPatience: save.settings.longerPatience },
    });
    narrRef.current = new Narrator();
    const teach = def.teach && TEACH[def.teach];
    if (teach) narrRef.current.teach(teach, 0, 5);
    else narrRef.current.say('shiftStart', 0, true);
    if (simRef.current.threat?.id === 'guest' && !def.threat?.boss && def.teach === 'guest') narrRef.current.say('guestEnters', 0);
    selRef.current = null;
    setSelected(null);
    sound.musicStart();
    return () => { sound.stopLayers(); haptics.rumble(null); };
  }, [def, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current!;
    rendRef.current = new RoomRenderer(canvas);
    const fit = () => {
      const st = stageRef.current;
      if (!st) return;
      const w = st.clientWidth, h = st.clientHeight;
      const cssW = Math.floor(Math.min(w, h / 1.3));
      rendRef.current!.resize(cssW, Math.floor(cssW * 1.3), Math.min(2.5, window.devicePixelRatio || 1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stageRef.current!);
    return () => ro.disconnect();
  }, []);

  const handleEvent = useCallback((s: ShiftState, e: SimEvent) => {
    const n = narrRef.current;
    const t = s.time;
    rendRef.current?.onEvent(s, e);
    switch (e.type) {
      case 'screamStart': sound.screamStart(); haptics.rumble('scream'); break;
      case 'screamEnd': sound.screamStop(); haptics.rumble(null); break;
      case 'understood': sound.play('oh'); haptics.tick(); break;
      case 'misunderstood': sound.play('hm'); if (s.staff.find((m) => m.id === e.staff)?.job?.kind !== 'ask') n.say('wrongResponse', t); break;
      case 'demandMet':
        sound.play('chime'); haptics.pulse();
        if (e.kind === 'food') n.say((e.value ?? 0) > 10 ? 'fedLate' : 'fed', t, true);
        else if (e.kind === 'door') n.say('doorDone', t);
        else if (e.kind === 'lap') n.say('lapDone', t);
        else n.say('playDone', t);
        break;
      case 'demandExpired': sound.play('hiss'); haptics.doublePulse(); n.say('demandExpired', t, true); break;
      case 'outburst':
        sound.play('yowl'); haptics.firm();
        setFlash(true); window.setTimeout(() => setFlash(false), 60);
        if (e.kind === 'bite') window.setTimeout(() => sound.play('yelp'), 250);
        n.say('outburst', t, true);
        break;
      case 'knocked': sound.play('crash', e.value); haptics.pulse(); break;
      case 'brainPresent': sound.play('ding'); haptics.tick(); break;
      case 'lapse': sound.play(Math.random() < 0.5 ? 'bonk' : 'slide'); haptics.double(); break;
      case 'lapseEnded': n.say(s.cat.lapse === 'box' ? 'boxLapse' : 'lapseEnded', t, true); break;
      case 'throneClaimed': sound.play('fanfare'); haptics.long(); n.say('throneClaimed', t, true); break;
      case 'sprayed': sound.play('spritz'); haptics.sharp(); n.say('sprayed', t, true); break;
      case 'smack':
        sound.play('smack'); haptics.tick();
        if (e.kind !== 'dog') n.say(e.value ? 'strokedTooLong' : 'smack', t, !!e.value);
        break;
      case 'evicted': n.say('evicted', t, true); break;
      case 'anticipated': n.say('anticipated', t); break;
      case 'door': sound.play('door'); break;
      case 'bowlFilled': sound.play('pour'); break;
      case 'hooverStart': sound.setHoover(true); n.say('hooverStart', t, true); break;
      case 'hooverStopped': sound.setHoover(false); n.say('hooverStopped', t); break;
      case 'hooverResumed': sound.setHoover(true); break;
      case 'hooverEnd': sound.setHoover(false); break;
      case 'moraleLevel':
        if (e.kind === 'boundaries') n.say('moraleLow', t, true);
        if (e.kind === 'spray') n.say('moraleSpray', t, true);
        break;
      case 'carrier': sound.play('fail'); n.say('carrier', t, true); break;
      case 'dogEnters': sound.play('woof'); n.say('dogEnters', t, true); break;
      case 'dogAteIt': sound.play('woof'); n.say('dogAteIt', t, true); break;
      case 'dogSprawl': n.say('dogSprawl', t); break;
      case 'dogYelp': sound.play('whine'); n.say('dogSmacked', t); break;
      case 'dogTilt': n.say('dogTilt', t); break;
      case 'dogBroke': sound.play('crash', 1); n.say('dogBroke', t); break;
      case 'dogFussed': n.say('dogFussed', t); break;
      case 'schemeStep': sound.play('scheme', e.value ?? 1); haptics.tick(); break;
      case 'schemeDone': sound.play('fanfare'); n.say(e.kind === 'treats' ? 'treats' : 'schemeDone', t, true); break;
      case 'guestWon': sound.play('win'); n.say('guestWon', t, true); break;
      case 'objectiveMet': n.say('objectiveMet', t, true); sound.play('chime'); break;
      case 'shiftEnd': sound.play(s.status === 'won' ? 'win' : 'fail'); break;
      default:
    }
  }, []);

  // Main loop: fixed 1/30 s simulation steps, drawing as often as the device allows
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let vis = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const s = simRef.current;
      const r = rendRef.current;
      if (!s || !r) return;
      let dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (pausedRef.current) dt = 0;
      acc += dt;
      while (acc >= TUNING.dt && s.status === 'running') {
        acc -= TUNING.dt;
        step(s);
        const evs = s.events.splice(0);
        for (const e of evs) handleEvent(s, e);
      }
      if (s.status !== 'running') {
        const evs = s.events.splice(0);
        for (const e of evs) handleEvent(s, e);
      }
      vis += dt;
      // Continuous feedback layers
      const inBand = s.def.systems.band && s.cat.inBand && s.status === 'running' && !s.cat.screaming;
      sound.setPurr(inBand && dt > 0 ? 0.6 : 0);
      sound.setGrowl(s.def.systems.irritation && !s.cat.inBand && dt > 0 ? s.cat.irritation / 100 : 0);
      sound.musicTension(s.length - s.time < 15 || (s.threat?.id === 'hoover' && hooverData(s.threat).state === 'running'));
      if (!s.cat.screaming) haptics.rumble(inBand && dt > 0 ? 'purr' : null);
      // "I am being ignored"
      if (s.def.systems.band && s.cat.attention < s.band.centre - s.band.halfWidth) belowRef.current += dt; else belowRef.current = 0;
      if (belowRef.current > 7) { narrRef.current.say('ignored', s.time); belowRef.current = 0; }
      if (tapRef.current) { tapRef.current.t += dt * 2.5; if (tapRef.current.t >= 1) tapRef.current = null; }
      if (selRef.current && !stillValid(s, selRef.current)) { selRef.current = null; setSelected(null); }
      r.draw(s, { selected: selRef.current, reduceMotion, time: vis, teach: s.def.teach ?? null, tapRing: tapRef.current }, dt);
      setFrame((f) => (f + 1) % 1000000);
      if (s.status !== 'running' && !finishedRef.current) {
        finishedRef.current = true;
        sound.stopLayers();
        haptics.rumble(null);
        window.setTimeout(() => onFinish(s), 1400);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [handleEvent, onFinish, reduceMotion, attempt]);

  useEffect(() => {
    if (pausedExternally || paused) { sound.stopLayers(); haptics.rumble(null); sound.suspend(); }
    else sound.resume();
  }, [pausedExternally, paused]);

  const s = simRef.current;

  const input = (i: Parameters<typeof applyInput>[1]) => {
    const st = simRef.current;
    if (!st || pausedRef.current) return;
    sound.ensure();
    applyInput(st, i);
    const evs = st.events.splice(0);
    for (const e of evs) handleEvent(st, e);
  };

  const onCanvasDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const st = simRef.current, r = rendRef.current;
    if (!st || !r || pausedRef.current) return;
    sound.ensure();
    const rect = ev.currentTarget.getBoundingClientRect();
    const px = ev.clientX - rect.left, py = ev.clientY - rect.top;
    const target = r.hit(st, px, py);
    const p = r.toRoom(px, py);
    tapRef.current = { x: p.x, y: p.y, t: 0 };
    if (!target) { selRef.current = null; setSelected(null); return; }
    if (target.kind === 'spot') {
      selRef.current = null; setSelected(null);
      input({ type: 'tapSpot', spot: target.id });
      return;
    }
    const verbs = verbsFor(st, target);
    if (verbs.length === 0) {
      selRef.current = null; setSelected(null);
      // Nothing to do to it yet: just walk over
      const near = r.hit(st, px, py + 12);
      if (near?.kind === 'spot') input({ type: 'tapSpot', spot: near.id });
      return;
    }
    if (verbs.length === 1) {
      selRef.current = null; setSelected(null);
      input({ type: 'verb', verb: verbs[0], target });
      haptics.tick();
      return;
    }
    selRef.current = target;
    setSelected(target);
    haptics.tick();
  };

  const doVerb = (v: Verb) => {
    if (!selected) return;
    input({ type: 'verb', verb: v, target: selected });
    selRef.current = null;
    setSelected(null);
  };

  const screamDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setHeld(true);
    input({ type: 'screamStart' });
  };
  const screamUp = () => {
    if (!held) return;
    setHeld(false);
    input({ type: 'screamEnd' });
  };

  useEffect(() => {
    const kd = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) { setHeld(true); input({ type: 'screamStart' }); } if (e.code === 'Escape') setPaused((p) => !p); };
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') { setHeld(false); input({ type: 'screamEnd' }); } };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  });

  const sys = def.systems;
  const timeLeft = s ? Math.max(0, Math.ceil(s.length - s.time)) : def.length;
  const cap = s ? narrRef.current.text(s.time) : null;
  const verbs = s && selected ? verbsFor(s, selected) : [];
  const scheme = s && schemeAvailable(s) ? schemeHere(s) : null;
  const ml = s ? moraleLevel(s.morale) : 'fine';

  return (
    <div className="shift">
      <div className="topbar">
        <button className="icon-btn" aria-label="Pause" onClick={() => { setPaused(true); sound.play('ui'); }}><Icon name="pause" /></button>
        <div className="objective">
          <div className="t">{objectiveText(def)}</div>
          <div className="s">{s ? objectiveProgress(s) : ''}{s?.objectiveMet ? ' ✓' : ''} · {def.title}</div>
        </div>
        <div className={`timer ${timeLeft <= 10 ? 'low' : ''}`} aria-label="Time remaining">{timeLeft}</div>
      </div>

      <div className="stage" ref={stageRef}>
        <canvas ref={canvasRef} onPointerDown={onCanvasDown} aria-label={`The ${ROOMS[def.room].name.toLowerCase()}`} />
        {s && <ThreatBars s={s} />}
        <div className={`flash ${flash ? 'on' : ''}`} />
      </div>

      <div className="hud">
        <div className={`caption ${cap?.teach ? 'teach' : ''}`} aria-live="polite">{cap ? (cap.teach ? cap.text : `“${cap.text}”`) : ' '}</div>
        {sys.band && s && <AttentionBand s={s} />}
        {(sys.irritation || sys.morale || sys.brainCell) && s && (
          <div className="gauges">
            {sys.irritation && (
              <button
                className={`gauge irr ${s.cat.irritation >= TUNING.irritation.deliberateMin && canAct(s) ? 'ready' : ''}`}
                onClick={() => input({ type: 'outburst' })}
                aria-label={`Irritation ${Math.round(s.cat.irritation)}. Tap at 50 or more for an Outburst.`}
              >
                <span className="lab"><Icon name="flame" size={14} /> Irritation{s.cat.irritation >= 50 ? ' · tap' : ''}</span>
                <div className="bar"><div style={{ width: `${s.cat.irritation}%` }} /><span className="tick" style={{ left: '50%' }} /></div>
              </button>
            )}
            {sys.brainCell && <BrainCell s={s} />}
            {sys.morale && (
              <div className={`gauge mor ${ml === 'boundaries' ? 'low' : ml === 'spray' || ml === 'carrier' ? 'vlow' : ''}`} aria-label={`Staff morale ${Math.round(s.morale)}`}>
                <span className="lab"><Icon name="heart" size={14} /> Morale {ml === 'boundaries' ? '· doors' : ml === 'spray' ? '· SPRAY' : ''}</span>
                <div className="bar"><div style={{ width: `${s.morale}%` }} /><span className="tick" style={{ left: '25%' }} /><span className="tick" style={{ left: '50%' }} /></div>
              </div>
            )}
          </div>
        )}
        <div className="controls">
          {verbs.length > 0 && (
            <div className="verb-arc">
              {verbs.map((v) => (
                <button key={v} className="verb" onClick={() => doVerb(v)} aria-label={VERB_LABEL[v]}>
                  <Icon name={v} size={26} />{VERB_LABEL[v]}
                </button>
              ))}
            </div>
          )}
          <div className="side l">
            {scheme && (
              <button className="scheme-btn" onClick={() => input({ type: 'scheme' })}>
                <span className="row" style={{ gap: 6 }}><Icon name="scheme" size={18} />{scheme === 'treats' ? 'Treats' : scheme === 'plug' ? 'The plug' : 'The handle'} {(s?.scheme?.step ?? 0) + 1}/3</span>
              </button>
            )}
          </div>
          {sys.verbs.includes('scream') && (
            <button
              className={`scream ${held ? 'held' : ''} ${def.teach === 'scream' && s && s.tally.screams === 0 ? 'pulse' : ''}`}
              onPointerDown={screamDown} onPointerUp={screamUp} onPointerCancel={screamUp} onLostPointerCapture={screamUp}
              aria-label="Hold to scream"
            >
              <span className="col" style={{ gap: 0, alignItems: 'center' }}><Icon name="scream" size={34} />HOLD</span>
            </button>
          )}
          <div className="side r">
            {s?.objectiveMet && ['serve', 'claim', 'train'].includes(def.objective.kind) && s.status === 'running' && (
              <button className="btn end-btn" onClick={() => input({ type: 'endShift' })}>End shift</button>
            )}
          </div>
        </div>
      </div>

      {(paused) && (
        <div className="overlay" role="dialog" aria-label="Paused">
          <div className="card col" style={{ gap: 12 }}>
            <h2>Paused</h2>
            <p className="dim small" style={{ margin: 0 }}>{objectiveText(def)}. {def.title}.</p>
            <button className="btn" onClick={() => setPaused(false)}>Resume</button>
            <button className="btn secondary" onClick={() => { setPaused(false); setAttempt((a) => a + 1); }}>Restart shift</button>
            <button className="btn secondary" onClick={onSettings}>Settings</button>
            <button className="btn secondary" onClick={() => { sound.stopLayers(); onQuit(); }}>Leave shift</button>
          </div>
        </div>
      )}
    </div>
  );
}

function stillValid(s: ShiftState, t: TargetRef) {
  if (t.kind === 'staff') return !!s.staff.find((m) => m.id === t.id && m.present);
  if (t.kind === 'object') return !!s.objects.find((o) => o.id === t.id && !o.knocked);
  if (t.kind === 'dog') return s.threat?.id === 'dog' && dogData(s.threat).present;
  return true;
}

function AttentionBand({ s }: { s: ShiftState }) {
  const b = s.band;
  const left = Math.max(0, b.centre - b.halfWidth);
  const right = Math.min(100, b.centre + b.halfWidth);
  const inBand = s.cat.inBand;
  return (
    <div className="band" role="meter" aria-valuenow={Math.round(s.cat.attention)} aria-label={`Attention ${Math.round(s.cat.attention)}, wanted ${Math.round(left)} to ${Math.round(right)}`}>
      <span className="end l"><Icon name="eyeClosed" size={16} /></span>
      <span className="end r"><Icon name="hand" size={16} /></span>
      <div className={`zone ${inBand ? 'on' : ''}`} style={{ left: `${left}%`, width: `${right - left}%` }} />
      <div className={`marker ${inBand ? '' : 'shake'}`} style={{ left: `${s.cat.attention}%` }}>
        <MarkerHead cross={!inBand} />
      </div>
    </div>
  );
}

function BrainCell({ s }: { s: ShiftState }) {
  const ph = s.cat.brain.phase;
  const label = ph === 'present' ? 'his' : ph === 'arriving' ? 'on its way' : 'elsewhere';
  return (
    <div className={`brain ${ph}`} aria-label={`Brain Cell: ${label}`}>
      <Icon name="brain" size={22} />
      <span>{label}</span>
    </div>
  );
}

function ThreatBars({ s }: { s: ShiftState }) {
  const out: React.ReactNode[] = [];
  if (s.threat?.id === 'hoover') {
    const h = hooverData(s.threat);
    if (h.state !== 'waiting' && h.state !== 'done') {
      out.push(
        <div className="meter" key="h">The Hoover {h.state === 'stopped' ? '· stopped' : ''}<div className="bar"><div style={{ width: `${h.progress}%` }} /></div></div>,
      );
    }
  }
  if (s.threat?.id === 'dog' && s.threat.spec.boss) {
    const d = dogData(s.threat);
    out.push(<div className="meter" key="d">{DOG.name} as favourite<div className="bar"><div style={{ width: `${d.favour}%`, background: '#b86a2e' }} /></div></div>);
  }
  if (s.threat?.id === 'guest' && s.threat.spec.boss) {
    const g = s.staff.find((m) => m.id === 'guest');
    out.push(<div className="meter" key="g">Clive’s Lap compliance<div className="bar"><div style={{ width: `${Math.min(100, ((g?.compliance.lap ?? 0) / 60) * 100)}%`, background: '#00f5f5' }} /></div></div>);
  }
  if (!out.length) return null;
  return <div className="threatbar">{out}</div>;
}
