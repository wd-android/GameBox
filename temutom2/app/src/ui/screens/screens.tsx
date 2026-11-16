import { useEffect, useRef, useState } from 'react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import type { SaveData, Settings } from '../../state/save';
import { MOMENTS, WEEKS, TOTAL_STARS } from '../../content/moments';
import { PLACES, OBJECT_NAMES } from '../../content/places';
import { FIELD_NOTES, NOTE_GROUPS } from '../../content/fieldNotes';
import { APP } from '../../config/app';
import { SCREEN } from '../../config/tuning';
import type { Display, Mark } from '../../sim/types';
import { drawCat } from '../scene/catArt';
import { drawPlace } from '../scene/placeArt';
import { drawObject } from '../scene/objects';
import { EffectsRenderer } from '../effects/effects';
import { Icon, Stars } from './icons';
import { isUnlocked, nextMoment, standing, totalStars, type MomentResult } from '../../game/progress';
import { STANDING } from '../../game/scoring';
import { dayCardText, type DayCard } from '../../game/reviews';
import { dateKey, MOODS, prettyDate, todaysMood } from '../../game/daily';
import { objectiveText } from './MomentScreen';
import { sound } from '../../audio/sound';

export async function shareText(text: string) {
  try {
    if (Capacitor.isNativePlatform()) { await Share.share({ text }); return 'shared'; }
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
  } catch { /* cancelled */ }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}

const BASE_DISPLAY: Display = {
  mood: 'content', pose: 'loaf', head: 'neutral', ears: 'relaxed', eyes: 'half', align: 0, glint: false, tail: 'still', paw: null,
  gaze: null, sound: 'none', rumble: null, tell: null, wiggle: false, confused: false,
};

/** A little live portrait of him, for menus */
export function CatCanvas({ w, h, display, scale = 1, x, y }: { w: number; h: number; display?: Partial<Display>; scale?: number; x?: number; y?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const t0 = performance.now();
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const d = { ...BASE_DISPLAY, ...display, eyes: (display?.eyes ?? (Math.sin(t * 0.8) > 0.93 ? 'slowBlink' : 'half')) as Display['eyes'] };
      drawCat(ctx, { x: x ?? w / 2, y: y ?? h - 6, scale, facing: -1, display: d, t, reduceMotion: false });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [w, h, scale, x, y, display]);
  return <canvas ref={ref} style={{ width: w, height: h, pointerEvents: 'none' }} aria-hidden="true" />;
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="row" style={{ marginBottom: 14 }}>
      <button className="icon-btn" onClick={() => { sound.play('ui'); onBack(); }} aria-label="Back"><Icon name="back" /></button>
      <h2 style={{ flex: 1 }}>{title}</h2>
    </div>
  );
}

/** Marks from the last moment stay on the glass until the next moment starts (§9.1) */
export function LastMarks({ marks }: { marks: Mark[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const fx = new EffectsRenderer(c);
    const fit = () => {
      const W = window.innerWidth, H = window.innerHeight;
      const k = Math.min(W / SCREEN.w, H / SCREEN.h);
      fx.resize(W, H, window.devicePixelRatio || 1, k, (W - SCREEN.w * k) / 2, (H - SCREEN.h * k) / 2);
      fx.draw(5, marks.map((m) => ({ ...m, born: 0 })), null, null);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [marks]);
  return <canvas ref={ref} className="fx" style={{ position: 'fixed' }} aria-hidden="true" />;
}

/** The sofa, behind the Home screen */
function SofaBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const W = window.innerWidth, H = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d')!;
    const k = Math.max(W / SCREEN.w, H / SCREEN.h);
    ctx.setTransform(k * dpr, 0, 0, k * dpr, ((W - SCREEN.w * k) / 2) * dpr, ((H - SCREEN.h * k) / 2) * dpr);
    drawPlace(ctx, 'sofa', { doorOpen: 0, night: false, cupboardOpen: false, lidClosed: false });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(24,0,56,0.72)'; ctx.fillRect(0, 0, c.width, c.height);
  }, []);
  return <canvas ref={ref} className="home-scene" style={{ position: 'fixed', width: '100%', height: '100%' }} aria-hidden="true" />;
}

const HOME_TILES = ['weeks', 'notes', 'archive', 'cabinet'] as const;

export function Home({ save, go, playNext, playMood }: { save: SaveData; go: (id: string) => void; playNext: () => void; playMood: () => void }) {
  const st = standing(save);
  const stars = totalStars(save);
  const nx = nextMoment(save);
  const today = dateKey(new Date());
  const mood = MOODS.find((m) => m.id === todaysMood(today).modifiers![0])!;
  // 30% chance he is sitting on one of the menu buttons — never Continue or Settings (§15.1)
  const [satOn, setSatOn] = useState<string | null>(() => (Math.random() < 0.3 ? HOME_TILES[Math.floor(Math.random() * HOME_TILES.length)] : null));
  const [taps, setTaps] = useState(0);
  const [cap, setCap] = useState('');
  useEffect(() => {
    if (!satOn) return;
    const id = window.setTimeout(() => setSatOn(null), 10000);
    return () => window.clearTimeout(id);
  }, [satOn]);
  const tapCat = () => {
    const n = taps + 1;
    setTaps(n);
    if (n >= 3 || Math.random() < 0.5) { setSatOn(null); setCap(''); sound.play('mrrp'); }
    else { setCap(['I am sitting here.', 'No.', 'This is my button.', 'Find another button.'][n % 4]); sound.play('mrrp'); }
  };
  const tile = (id: (typeof HOME_TILES)[number], title: string, sub: string) => (
    <div className="sat-on" key={id}>
      <button className="tile" style={{ width: '100%' }} disabled={satOn === id} onClick={() => go(id)}>
        <span className="tt">{title}</span><span className="ts">{sub}</span>
      </button>
      {satOn === id && (
        <button aria-label="Temutom is sitting on this button" onClick={tapCat} style={{ position: 'absolute', inset: '-30px 0 0 0', background: 'none', border: 'none' }}>
          <CatCanvas w={170} h={120} display={{ pose: 'sitOn', tail: 'flick', ears: 'sideways', eyes: 'half' }} scale={0.7} />
        </button>
      )}
    </div>
  );
  return (
    <>
      <SofaBackdrop />
      <div className="screen home-ui">
        <div className="row">
          <span className="chip"><Icon name="crown" size={14} /> {st.name}</span>
          <span className="chip orange">★ {stars} / {TOTAL_STARS}</span>
          <div className="spacer" />
          <button className="icon-btn" aria-label="Settings" onClick={() => go('settings')}><Icon name="cog" /></button>
        </div>
        <div className="col" style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
          <CatCanvas w={220} h={170} display={{ pose: satOn ? 'sit' : 'loaf' }} scale={satOn ? 0.9 : 1.1} />
          <div className="logo" style={{ fontSize: 34 }}>Living with<br /><span>Temutom</span></div>
          <div className="dim small">He employs you. Keep your thumb away from his teeth.</div>
          {cap && <div className="review">“{cap}”</div>}
        </div>
        <div className="col" style={{ marginTop: 18 }}>
          <button className="btn" onClick={playNext}>Continue · W{nx.week} D{nx.day} <span style={{ textTransform: 'capitalize' }}>{nx.slot}</span></button>
          <button className="btn violet" onClick={playMood}>Today’s Mood{save.mood.history[today] !== undefined ? ` · ${save.mood.history[today]}` : ''}</button>
          <div className="small dim" style={{ textAlign: 'center' }}>{mood.name}. Streak {save.mood.streak}.</div>
        </div>
        <div className="menu-grid" style={{ marginTop: 16 }}>
          {tile('weeks', 'Weeks', 'Every moment and its stars')}
          {tile('notes', 'Field Notes', `${save.notes.filter((n) => FIELD_NOTES.some((f) => f.id === n)).length} of ${FIELD_NOTES.length}`)}
          {tile('archive', 'Reviews', `${save.archive.length} day cards`)}
          {tile('cabinet', 'Cabinet', `${new Set(save.cabinet).size} things knocked off`)}
        </div>
      </div>
      {save.marks.length > 0 && <LastMarks marks={save.marks} />}
    </>
  );
}

export function Weeks({ save, onBack, play }: { save: SaveData; onBack: () => void; play: (id: string) => void }) {
  const [week, setWeek] = useState(nextMoment(save).week);
  return (
    <div className="screen">
      <Header title="Weeks" onBack={onBack} />
      <div className="tabs">{WEEKS.map((w) => <button key={w.n} className={`chip ${week === w.n ? '' : 'off'}`} onClick={() => setWeek(w.n)}>Week {w.n}: {w.difficulty}</button>)}</div>
      <p className="dim small">{WEEKS[week - 1].blurb}</p>
      <div className="list">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <div key={d} className="card col" style={{ gap: 6, padding: 12 }}>
            <h3>Day {d}</h3>
            {MOMENTS.filter((m) => m.week === week && m.day === d).map((m) => {
              const open = isUnlocked(save, m.id);
              return (
                <button key={m.id} className={`shift-row ${open ? '' : 'locked'} ${m.objective.kind === 'boss' && (m.difficulty?.boss) ? 'boss' : ''}`} disabled={!open} onClick={() => play(m.id)}>
                  <span className="slot">{m.slot === 'dawn' ? '4:50am' : m.slot}</span>
                  <span style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</div>
                    <div className="dim" style={{ fontSize: 12 }}>{PLACES[m.place].name} · {objectiveText(m)}</div>
                  </span>
                  <Stars n={save.moments[m.id]?.stars ?? 0} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Result({ r, save, marks, onNext, onRetry, onHome, nextLabel }: { r: MomentResult; save: SaveData; marks: Mark[]; onNext: () => void; onRetry: () => void; onHome: () => void; nextLabel: string }) {
  const [shared, setShared] = useState('');
  const failTitle = r.reason === 'plasters' ? 'Go and run that under the tap.' : r.reason === 'noExtraFood' ? 'He got into the cupboard.' : 'Not this time.';
  return (
    <>
      <div className="screen" style={{ justifyContent: 'center' }}>
        <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 6 }}>
          <h1>{r.won ? 'Moment survived.' : failTitle}</h1>
          {!r.won && <div className="dim small">One tap and it never happened.</div>}
          <div className="big-score">{r.score}</div>
          <div className="result-stars">{[0, 1, 2].map((i) => <span key={i} className={i < r.stars ? 'on' : 'stars'}><span className={i < r.stars ? '' : 'off'}>★</span></span>)}</div>
          <div className="dim small">Chore {Math.round(r.parts.chore)} · Content {Math.round(r.parts.content)} · First time {Math.round(r.parts.firstTime)} · Plasters {Math.round(r.parts.plasters)}</div>
          {r.standingUp && <span className="chip orange"><Icon name="crown" size={14} /> Standing: {r.standingUp}</span>}
          {r.newNotes.length > 0 && <span className="chip">{r.newNotes.length} new field note{r.newNotes.length > 1 ? 's' : ''}</span>}
          {r.newCabinet.length > 0 && <span className="chip">Cabinet: {r.newCabinet.map((k) => OBJECT_NAMES[k] ?? k).join(', ')}</span>}
        </div>
        <div className="card col" style={{ marginTop: 16, alignItems: 'center', textAlign: 'center' }}>
          <CatCanvas w={140} h={100} display={{ pose: 'loaf', ears: r.stars === 3 ? 'relaxed' : 'sideways', tail: r.stars === 3 ? 'still' : 'flick' }} scale={0.75} />
          <h3>His review of you</h3>
          <div className="review">“{r.review}”</div>
        </div>
        {r.daily && (
          <div className="col" style={{ marginTop: 12 }}>
            {!r.daily.scored && <div className="dim small" style={{ textAlign: 'center' }}>Practice: today’s scored attempt is already in.</div>}
            <button className="btn secondary" onClick={async () => setShared(await shareText(r.daily!.text))}><Icon name="share" size={18} /> Share {shared && `· ${shared}`}</button>
          </div>
        )}
        <div className="col" style={{ marginTop: 16 }}>
          {r.won ? <button className="btn" onClick={onNext}>{nextLabel}</button> : <button className="btn" onClick={onRetry}>Retry</button>}
          {r.won && <button className="btn secondary" onClick={onRetry}>Retry</button>}
          {save.played >= 3 && <button className="btn secondary" onClick={onHome}>Home</button>}
        </div>
      </div>
      {marks.length > 0 && <LastMarks marks={marks} />}
    </>
  );
}

export function DayCardView({ card }: { card: DayCard }) {
  return (
    <div className="cert col" style={{ gap: 10, padding: 18 }}>
      <div className="row">
        <div style={{ width: 64, height: 56, borderRadius: 12, background: '#ffe2b8', display: 'grid', placeItems: 'center' }}><CatCanvas w={64} h={56} scale={0.38} /></div>
        <div><div style={{ fontWeight: 700, fontSize: 18 }}>Review of You</div><div style={{ fontSize: 12, opacity: 0.7 }}>Week {card.week}, Day {card.day} · by Temutom, Management</div></div>
      </div>
      <div><b>You.</b> <i>{card.paragraph}</i> <b>{card.verdict}.</b></div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>Average score {card.average}</div>
    </div>
  );
}

export function DayReview({ card, onDone }: { card: DayCard; onDone: () => void }) {
  const [shared, setShared] = useState('');
  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <DayCardView card={card} />
      <div className="col" style={{ marginTop: 16 }}>
        <button className="btn secondary" onClick={async () => setShared(await shareCard(card))}><Icon name="share" size={18} /> Share {shared && `· ${shared}`}</button>
        <button className="btn" onClick={onDone}>Continue</button>
      </div>
    </div>
  );
}

async function shareCard(card: DayCard) {
  const text = dayCardText(card);
  try {
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1080;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff7e8'; ctx.fillRect(0, 0, 1080, 1080);
    ctx.strokeStyle = '#e2c48a'; ctx.lineWidth = 24; ctx.strokeRect(12, 12, 1056, 1056);
    drawCat(ctx, { x: 160, y: 330, scale: 1.6, facing: 1, display: BASE_DISPLAY, t: 0, reduceMotion: true });
    ctx.fillStyle = '#3a2a1a'; ctx.font = 'bold 64px "Readex Pro", sans-serif'; ctx.fillText('Review of You', 320, 150);
    ctx.font = '34px "Readex Pro", sans-serif'; ctx.fillText(`Week ${card.week}, Day ${card.day} · by Temutom, Management`, 320, 210);
    ctx.font = 'italic 40px "Readex Pro", sans-serif';
    let y = 480, line = '';
    for (const w of `You. ${card.paragraph} ${card.verdict}.`.split(' ')) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > 920 && line) { ctx.fillText(line, 80, y); y += 56; line = w; } else line = t;
    }
    ctx.fillText(line, 80, y);
    ctx.font = '30px "Readex Pro", sans-serif'; ctx.fillText(`${APP.displayName} · average ${card.average}`, 80, 1020);
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, 'image/png'));
    const file = blob ? new File([blob], 'temutom-review.png', { type: 'image/png' }) : null;
    if (file && !Capacitor.isNativePlatform() && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return 'shared'; }
  } catch { /* text instead */ }
  return shareText(text);
}

export function Archive({ save, onBack }: { save: SaveData; onBack: () => void }) {
  return (
    <div className="screen">
      <Header title="Reviews" onBack={onBack} />
      {save.archive.length === 0 && <p className="dim">Finish all five moments of a day to receive his review card.</p>}
      <div className="list">{save.archive.map((c, i) => <DayCardView key={i} card={c} />)}</div>
    </div>
  );
}

export function FieldNotes({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const [group, setGroup] = useState(NOTE_GROUPS[0]);
  const zones = ['head', 'back', 'tail', 'paws', 'belly'];
  return (
    <div className="screen">
      <Header title="Field Notes" onBack={onBack} />
      <div className="tabs">{NOTE_GROUPS.map((g) => <button key={g} className={`chip ${group === g ? '' : 'off'}`} onClick={() => setGroup(g)}>{g}</button>)}</div>
      {group === 'Touch map' && (
        <div className="card row" style={{ justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <CatCanvas w={200} h={140} display={{ pose: 'bellyUp' }} scale={0.95} />
          <div className="col" style={{ gap: 4 }}>
            {zones.map((z) => {
              const known = save.notes.includes(`zone-${z}`);
              const safe = z === 'head' ? 'safe' : z === 'back' ? 'for a while' : 'NO';
              return <div key={z} className="small" style={{ color: known ? (safe === 'NO' ? '#ff4d6d' : safe === 'safe' ? '#00f5a0' : '#ffca28') : 'var(--dim)' }}>{known ? `● ${z}: ${safe}` : `○ ${z}: ?`}</div>;
            })}
          </div>
        </div>
      )}
      <div className="notes-grid" style={{ marginTop: 10 }}>
        {FIELD_NOTES.filter((n) => n.group === group).map((n) => {
          const open = save.notes.includes(n.id);
          return (
            <div key={n.id} className={`note ${open ? '' : 'locked'}`}>
              <b>{open ? n.title : '???'}</b>
              <div>{open ? n.text : 'Not yet observed.'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ObjectIcon({ kind, found }: { kind: string; found: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = 48 * dpr; c.height = 48 * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr * 3.4, 0, 0, dpr * 3.4, 0, 0);
    if (!found) ctx.filter = 'brightness(0) opacity(0.5)';
    if (kind === 'scoreCounter' || kind === 'plasterCounter') {
      ctx.fillStyle = kind === 'scoreCounter' ? '#00f5f5' : '#f5c08a'; ctx.fillRect(2, 5, 10, 5);
    } else drawObject(ctx, kind, 7, 11);
  }, [kind, found]);
  return <canvas ref={ref} style={{ width: 48, height: 48 }} aria-hidden="true" />;
}

export function Cabinet({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const found = new Set(save.cabinet);
  const kinds = Object.keys(OBJECT_NAMES);
  return (
    <div className="screen">
      <Header title="The Cabinet" onBack={onBack} />
      <p className="dim small" style={{ marginTop: 0 }}>Things he has knocked off a surface · {found.size} of {kinds.length}</p>
      <div className="cabinet-grid">
        {kinds.map((k) => (
          <div key={k} className={`cab ${found.has(k) ? 'found' : ''}`}>
            <ObjectIcon kind={k} found={found.has(k)} />
            {found.has(k) ? OBJECT_NAMES[k] : '?'}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsScreen({ save, onChange, onBack, onReset }: { save: SaveData; onChange: (s: Settings) => void; onBack: () => void; onReset: () => void }) {
  const s = save.settings;
  const [confirm, setConfirm] = useState(false);
  const devRM = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const T = ({ k, label, sub }: { k: keyof Settings; label: string; sub?: string }) => {
    const raw = s[k];
    const val = k === 'reduceMotion' || k === 'reduceFlashing' ? (raw ?? devRM) as boolean : !!raw;
    return (
      <div className="toggle">
        <div><div style={{ fontWeight: 600 }}>{label}</div>{sub && <div className="dim small">{sub}</div>}</div>
        <button className={`switch ${val ? 'on' : ''}`} role="switch" aria-checked={val} aria-label={label} onClick={() => onChange({ ...s, [k]: !val })} />
      </div>
    );
  };
  return (
    <div className="screen">
      <Header title="Settings" onBack={onBack} />
      <div className="card" style={{ padding: '4px 14px' }}>
        <T k="music" label="Music" />
        <T k="sfx" label="Sound effects" />
        <T k="vibration" label="Vibration" />
        <T k="reduceFlashing" label="Reduce flashing" sub={s.reduceFlashing === null ? 'Following the device' : 'Softer, slower red wash'} />
        <T k="reduceMotion" label="Reduce motion" sub={s.reduceMotion === null ? 'Following the device' : undefined} />
        <T k="moodHints" label="Mood hints" sub="A small gauge of his attention and the band" />
        <T k="longerWarnings" label="Longer warnings" sub="Adds 0.4 s before any strike" />
        <T k="largerCaptions" label="Larger captions" />
        <T k="leftHanded" label="Left-handed layout" />
      </div>
      <div className="col" style={{ marginTop: 16 }}>
        {!confirm ? <button className="btn secondary" onClick={() => setConfirm(true)}>Reset progress</button> : (
          <div className="card col">
            <div>Erase all stars, field notes, reviews and Standing? This cannot be undone.</div>
            <button className="btn danger" onClick={() => { setConfirm(false); onReset(); }}>Yes, reset everything</button>
            <button className="btn secondary" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        )}
      </div>
      <p className="dim small" style={{ marginTop: 18 }}>{APP.displayName} · {APP.appId}. No personal data is collected and nothing leaves the device.</p>
    </div>
  );
}

export function MoodIntro({ save, onPlay, onBack }: { save: SaveData; onPlay: () => void; onBack: () => void }) {
  const key = dateKey(new Date());
  const def = todaysMood(key);
  const m = MOODS.find((x) => x.id === def.modifiers![0])!;
  const done = save.mood.history[key] !== undefined;
  return (
    <div className="screen">
      <Header title="Today’s Mood" onBack={onBack} />
      <div className="card col">
        <span className="chip">{prettyDate(key)}</span>
        <h2>{m.name}</h2>
        <div className="dim">{m.blurb}</div>
        <div className="small">{PLACES[def.place].name} · {objectiveText(def)} · the same cat for everyone</div>
        {done && <div className="small">Today’s score: <b>{save.mood.history[key]}</b>. Further attempts are practice.</div>}
        <div className="small dim">Streak: {save.mood.streak}</div>
      </div>
      <div className="col" style={{ marginTop: 16 }}><button className="btn violet" onClick={onPlay}>{done ? 'Practise' : 'Begin'}</button></div>
    </div>
  );
}

export { STANDING };
