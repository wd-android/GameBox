import { useEffect, useRef, useState } from 'react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import type { SaveData, Settings } from '../state/save';
import { SHIFTS, WEEKS, TOTAL_STARS } from '../content/shifts';
import { ROOMS, ROOM_ORDER, OBJECTS } from '../content/rooms';
import { STAFF, DOG } from '../content/staff';
import { APP } from '../config/app';
import { Icon, Stars } from './icons';
import { totalStars, nextShift, isUnlocked, type ShiftResult } from '../game/progress';
import { rankFor, RANKS } from '../game/scoring';
import { dayCardText, type DayCard } from '../game/reviews';
import { dateKey, dailyShift, MODIFIERS, prettyDate } from '../game/daily';
import { drawObject } from './art/objects';
import { drawCat } from './art/cat';
import { drawDog } from './art/people';
import { objectiveText } from './ShiftScreen';
import type { DemandKind, StaffId } from '../sim/types';
import { sound } from '../audio/sound';

export async function shareText(text: string) {
  try {
    if (Capacitor.isNativePlatform()) { await Share.share({ text }); return 'shared'; }
    if (navigator.share) { await navigator.share({ text }); return 'shared'; }
  } catch { /* cancelled */ }
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}

function Header({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="row" style={{ marginBottom: 14 }}>
      <button className="icon-btn" onClick={() => { sound.play('ui'); onBack(); }} aria-label="Back"><Icon name="back" /></button>
      <h2 style={{ flex: 1 }}>{title}</h2>
      {right}
    </div>
  );
}

/** A small canvas portrait of Temutom for menus */
export function CatPortrait({ size = 140, dog = false }: { size?: number; dog?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const t0 = performance.now();
    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      const k = (size * dpr) / 40;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      if (dog) drawDog(ctx, 15, 37, { facing: 1, mode: 'wander', t, walking: false, reduceMotion: false });
      else drawCat(ctx, 20, 36, { facing: 1, action: 'idle', t, eyesApart: Math.sin(t * 0.5) > 0.6, content: false, lash: 0.15, mouthOpen: 0, puffed: false, flat: false, inBox: false, held: false, reduceMotion: false }, 1.35);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size, dog]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------

export function Home({ save, go, playShift, playDaily }: { save: SaveData; go: (s: string) => void; playShift: (id: string) => void; playDaily: () => void }) {
  const stars = totalStars(save);
  const r = rankFor(stars);
  const nx = nextShift(save);
  const today = dateKey(new Date());
  const dailyDone = save.daily.history[today] !== undefined;
  const mod = dailyShift(today).modifiers![0];
  return (
    <div className="screen">
      <div className="row">
        <span className="chip"><Icon name="crown" size={14} /> {r.rank}</span>
        <span className="chip orange">★ {stars} / {TOTAL_STARS}</span>
        <div className="spacer" />
        <button className="icon-btn" aria-label="Settings" onClick={() => go('settings')}><Icon name="cog" /></button>
      </div>
      <div className="hero" style={{ marginTop: 18, alignItems: 'center', textAlign: 'center' }}>
        <CatPortrait size={150} />
        <div className="logo">Temutom<br /><span>Staff Management</span></div>
        <div className="dim small">You are an orange cat. The humans are underperforming staff.</div>
      </div>
      <div className="col" style={{ marginTop: 22 }}>
        <button className="btn" onClick={() => playShift(nx.id)}>
          Continue · W{nx.week} D{nx.day} <span style={{ textTransform: 'capitalize' }}>{nx.slot}</span>
        </button>
        <button className="btn violet" onClick={playDaily}>
          The Daily Grievance {dailyDone ? `· ${save.daily.history[today]}` : ''}
        </button>
        <div className="small dim" style={{ textAlign: 'center' }}>
          Today: {MODIFIERS.find((m) => m.id === mod)?.name}. Streak {save.daily.streak} day{save.daily.streak === 1 ? '' : 's'}.
        </div>
      </div>
      <div className="menu-grid" style={{ marginTop: 18 }}>
        <button className="tile" onClick={() => go('weeks')}><span className="tt">Weeks</span><span className="ts">Every shift and its stars</span></button>
        <button className="tile" onClick={() => go('house')}><span className="tt">House</span><span className="ts">{save.thrones.length} of 5 thrones</span></button>
        <button className="tile" onClick={() => go('staff')}><span className="tt">Staff</span><span className="ts">Files and training certificates</span></button>
        <button className="tile" onClick={() => go('cabinet')}><span className="tt">Cabinet</span><span className="ts">{new Set(save.cabinet).size} of 24 things</span></button>
        <button className="tile" onClick={() => go('archive')}><span className="tt">Reviews</span><span className="ts">{save.archive.length} day cards</span></button>
        <button className="tile" onClick={() => go('ranks')}><span className="tt">Rank</span><span className="ts">{r.next ? `${r.nextAt! - stars}★ to ${r.next}` : 'Emperor. Naturally.'}</span></button>
      </div>
    </div>
  );
}

export function Weeks({ save, onBack, playShift }: { save: SaveData; onBack: () => void; playShift: (id: string) => void }) {
  const nx = nextShift(save);
  const [week, setWeek] = useState(nx.week);
  const days = [1, 2, 3, 4, 5, 6, 7];
  return (
    <div className="screen">
      <Header title="Weeks" onBack={onBack} />
      <div className="tabs">
        {WEEKS.map((w) => (
          <button key={w.n} className={`chip ${week === w.n ? '' : 'off'}`} onClick={() => setWeek(w.n)}>Week {w.n}: {w.threat}</button>
        ))}
      </div>
      <p className="dim small">{WEEKS[week - 1].blurb}</p>
      <div className="list">
        {days.map((d) => (
          <div key={d} className="card col" style={{ gap: 6, padding: 12 }}>
            <h3>Day {d}</h3>
            {SHIFTS.filter((x) => x.week === week && x.day === d).map((x) => {
              const open = isUnlocked(save, x.id);
              const st = save.shifts[x.id]?.stars ?? 0;
              return (
                <button key={x.id} className={`shift-row ${open ? '' : 'locked'} ${x.objective.kind === 'boss' ? 'boss' : ''}`} disabled={!open} onClick={() => playShift(x.id)}>
                  <span className="slot">{x.slot}</span>
                  <span style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{x.title}</div>
                    <div className="dim" style={{ fontSize: 12 }}>{ROOMS[x.room].name} · {objectiveText(x)}</div>
                  </span>
                  <Stars n={st} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Result({ r, save, onNext, onRetry, onHome, nextLabel }: { r: ShiftResult; save: SaveData; onNext: () => void; onRetry: () => void; onHome: () => void; nextLabel: string }) {
  const [shared, setShared] = useState('');
  const def = SHIFTS.find((x) => x.id === r.shiftId);
  const title = r.daily ? 'The Daily Grievance' : def ? `W${def.week} D${def.day} · ${def.slot}` : '';
  const failTitle = r.reason === 'carrier' ? 'The Carrier.' : 'Shift failed.';
  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <div className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 6 }}>
        <span className="chip" style={{ textTransform: 'capitalize' }}>{title}</span>
        <h1 style={{ marginTop: 6 }}>{r.won ? 'Shift complete.' : failTitle}</h1>
        {!r.won && <div className="dim small">{r.reason === 'carrier' ? 'Morale reached zero. One tap and it never happened.' : 'The objective was not met. Nothing is lost; try again.'}</div>}
        <div className="big-score">{r.score}</div>
        <div className="result-stars">{[0, 1, 2].map((i) => <span key={i} className={i < r.stars ? 'on' : 'stars'}><span className={i < r.stars ? '' : 'off'}>★</span></span>)}</div>
        <div className="dim small">Demands {Math.round(r.parts.demands)} · In band {Math.round(r.parts.band)} · Morale {Math.round(r.parts.morale)} · Throne {r.parts.throne}</div>
        {r.throneClaimed && <span className="chip orange"><Icon name="crown" size={14} /> Throne claimed</span>}
        {r.newCabinet.length > 0 && <span className="chip">New in the cabinet: {r.newCabinet.map((k) => OBJECTS[k].name).join(', ')}</span>}
      </div>
      <div className="card col" style={{ marginTop: 16 }}>
        <h3>Performance review</h3>
        {r.reviews.map((x) => (
          <div key={x.staff}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{STAFF[x.staff].name} <span className="dim small">· {STAFF[x.staff].title}</span></div>
            <div className="review">“{x.line}”</div>
          </div>
        ))}
      </div>
      {r.daily && (
        <div className="col" style={{ marginTop: 12 }}>
          {!r.daily.scored && <div className="dim small" style={{ textAlign: 'center' }}>Practice run: today’s scored attempt is already in.</div>}
          <button className="btn secondary" onClick={async () => setShared(await shareText(r.daily!.text))}><Icon name="share" size={18} /> Share result {shared && `· ${shared}`}</button>
        </div>
      )}
      <div className="col" style={{ marginTop: 16 }}>
        {r.won ? <button className="btn" onClick={onNext}>{nextLabel}</button> : <button className="btn" onClick={onRetry}>Retry</button>}
        {r.won ? <button className="btn secondary" onClick={onRetry}>Retry for a better score</button> : null}
        {save.played >= 3 && <button className="btn secondary" onClick={onHome}>Home</button>}
      </div>
    </div>
  );
}

export function DayReview({ card, onDone }: { card: DayCard; onDone: () => void }) {
  const [shared, setShared] = useState('');
  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <DayCardView card={card} />
      <div className="col" style={{ marginTop: 16 }}>
        <button className="btn secondary" onClick={async () => setShared(await shareCard(card))}><Icon name="share" size={18} /> Share review {shared && `· ${shared}`}</button>
        <button className="btn" onClick={onDone}>Continue</button>
      </div>
    </div>
  );
}

export function DayCardView({ card }: { card: DayCard }) {
  return (
    <div className="cert col" style={{ gap: 10, padding: 18 }}>
      <div className="row"><CatPortraitTiny /><div><div style={{ fontWeight: 700, fontSize: 18 }}>Review of the Staff</div><div style={{ fontSize: 12, opacity: 0.7 }}>Week {card.week}, Day {card.day} · by Temutom, Management</div></div></div>
      {card.staff.map((x) => (
        <div key={x.staff}>
          <div style={{ fontWeight: 700 }}>{STAFF[x.staff].name} <span style={{ fontWeight: 400, opacity: 0.7 }}>({STAFF[x.staff].title})</span></div>
          <div style={{ fontStyle: 'italic' }}>{x.paragraph} <b>{x.verdict}.</b></div>
        </div>
      ))}
      <div style={{ fontSize: 12, opacity: 0.7 }}>Average score {card.average}</div>
    </div>
  );
}

function CatPortraitTiny() { return <div style={{ width: 52, height: 52, borderRadius: 12, background: '#ffe2b8', display: 'grid', placeItems: 'center' }}><CatPortrait size={48} /></div>; }

async function shareCard(card: DayCard) {
  const text = dayCardText(card);
  // Image share where the platform supports it; text otherwise.
  try {
    const canvas = renderCardImage(card);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    if (blob && !Capacitor.isNativePlatform() && navigator.canShare?.({ files: [new File([blob], 'review.png', { type: 'image/png' })] })) {
      await navigator.share({ files: [new File([blob], 'temutom-review.png', { type: 'image/png' })], text });
      return 'shared';
    }
  } catch { /* fall back to text */ }
  return shareText(text);
}

function renderCardImage(card: DayCard) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1350;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff7e8'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#e2c48a'; ctx.lineWidth = 24; ctx.strokeRect(12, 12, c.width - 24, c.height - 24);
  ctx.save(); ctx.scale(12, 12); drawCat(ctx, 12, 20, { facing: 1, action: 'idle', t: 0, eyesApart: false, content: false, lash: 0, mouthOpen: 0, puffed: false, flat: false, inBox: false, held: false, reduceMotion: true }); ctx.restore();
  ctx.fillStyle = '#3a2a1a';
  ctx.font = 'bold 64px "Readex Pro", sans-serif'; ctx.fillText('Review of the Staff', 290, 130);
  ctx.font = '36px "Readex Pro", sans-serif'; ctx.fillText(`Week ${card.week}, Day ${card.day} · by Temutom, Management`, 290, 190);
  let y = 340;
  for (const x of card.staff) {
    ctx.font = 'bold 44px "Readex Pro", sans-serif';
    ctx.fillText(`${STAFF[x.staff].name} (${STAFF[x.staff].title})`, 80, y);
    y += 60;
    ctx.font = 'italic 38px "Readex Pro", sans-serif';
    for (const line of wrap(ctx, `${x.paragraph} ${x.verdict}.`, 920)) { ctx.fillText(line, 80, y); y += 50; }
    y += 40;
  }
  ctx.font = '32px "Readex Pro", sans-serif';
  ctx.fillText(`${APP.displayName} · average score ${card.average}`, 80, c.height - 80);
  return c;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, w: number) {
  const out: string[] = []; let line = '';
  for (const word of text.split(' ')) {
    const t = line ? `${line} ${word}` : word;
    if (ctx.measureText(t).width > w && line) { out.push(line); line = word; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

export function Archive({ save, onBack }: { save: SaveData; onBack: () => void }) {
  return (
    <div className="screen">
      <Header title="Review archive" onBack={onBack} />
      {save.archive.length === 0 && <p className="dim">Finish all five shifts of a day to receive his review card.</p>}
      <div className="list">{save.archive.map((c, i) => <DayCardView key={i} card={c} />)}</div>
    </div>
  );
}

export function House({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const pct = Math.round((save.thrones.length / ROOM_ORDER.length) * 100);
  return (
    <div className="screen">
      <Header title="The House" onBack={onBack} />
      <div className="card col" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="big-score" style={{ fontSize: 48 }}>{pct}%</div>
        <div className="dim small">Domestic dominion{pct === 100 ? ' · TOTAL DOMESTIC DOMINION' : ''}</div>
      </div>
      <div className="housemap" style={{ marginTop: 14 }}>
        {ROOM_ORDER.map((id) => {
          const claimed = save.thrones.includes(id);
          return (
            <div key={id} className={`room-tile ${claimed ? 'claimed' : ''}`} style={id === 'hallway' ? { gridColumn: 'span 2' } : undefined}>
              <div style={{ fontWeight: 700 }}>{ROOMS[id].name}</div>
              <div className="row small" style={{ color: claimed ? '#ffca28' : 'var(--dim)' }}>
                <Icon name="crown" size={16} /> {ROOMS[id].throneName} {claimed ? '· claimed' : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DEMAND_NAMES: Record<DemandKind, string> = { food: 'Food', door: 'Door service', lap: 'Lap', play: 'Play' };

export function StaffFiles({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const ids: StaffId[] = ['soft', 'busy', 'guest'];
  const [sel, setSel] = useState<StaffId>('soft');
  const prof = STAFF[sel];
  return (
    <div className="screen">
      <Header title="Staff files" onBack={onBack} />
      <div className="tabs">
        {ids.map((id) => <button key={id} className={`chip ${sel === id ? '' : 'off'}`} onClick={() => setSel(id)}>{STAFF[id].name}</button>)}
        <button className={`chip ${sel === ('dog' as never) ? '' : 'off'}`} onClick={() => setSel('dog' as never)}>{DOG.name}</button>
      </div>
      {(sel as string) === 'dog' ? (
        <div className="card col" style={{ alignItems: 'center', textAlign: 'center' }}>
          <CatPortrait size={150} dog />
          <h3>{DOG.name} · {DOG.title}</h3>
          <p className="dim small" style={{ margin: 0 }}>A Doberman. Floppy ears, long tail, no thoughts. Eats food meant for management, sprawls on thrones, clears shelves with his tail. Not staff. Not anything, really.</p>
        </div>
      ) : (
        <div className="col">
          <div className="card col" style={{ gap: 4 }}>
            <h3>{prof.name}</h3>
            <div className="dim small">{prof.title}</div>
          </div>
          <div className="col">
            {(Object.keys(DEMAND_NAMES) as DemandKind[]).map((k) => {
              const v = Math.round(save.compliance[sel][k]);
              const lvl = v >= 60 ? 'High: serves before being asked' : v >= 30 ? 'Medium: usually right when told' : 'Low: misreads me';
              return (
                <div key={k} className="cert col" style={{ gap: 6 }}>
                  <div className="row"><b style={{ flex: 1 }}>Certificate of {DEMAND_NAMES[k]}</b><span>{v}{prof.cap != null ? ` / ${prof.cap}` : ''}</span></div>
                  <div className="pbar"><div style={{ width: `${v}%` }} /></div>
                  <div style={{ fontSize: 12 }}>{lvl}</div>
                </div>
              );
            })}
          </div>
          <div className="card col">
            <h3>Past reviews</h3>
            {save.staffReviews[sel].length === 0 && <div className="dim small">No reviews yet.</div>}
            {save.staffReviews[sel].slice(0, 12).map((l, i) => <div key={i} className="review small">{l}</div>)}
          </div>
        </div>
      )}
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
    const k = (48 * dpr) / 14;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (found) drawObject(ctx, kind, 7, 11);
    else {
      ctx.globalAlpha = 0.6;
      ctx.filter = 'brightness(0)';
      drawObject(ctx, kind, 7, 11);
    }
  }, [kind, found]);
  return <canvas ref={ref} style={{ width: 48, height: 48 }} aria-hidden="true" />;
}

export function Cabinet({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const found = new Set(save.cabinet);
  return (
    <div className="screen">
      <Header title="The Cabinet" onBack={onBack} />
      <p className="dim small" style={{ marginTop: 0 }}>Things That Were Too Close to the Edge · {found.size} of 24</p>
      <div className="cabinet-grid">
        {Object.entries(OBJECTS).map(([k, o]) => (
          <div key={k} className={`cab ${found.has(k) ? 'found' : ''}`}>
            <ObjectIcon kind={k} found={found.has(k)} />
            {found.has(k) ? o.name : '?'}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Ranks({ save, onBack }: { save: SaveData; onBack: () => void }) {
  const stars = totalStars(save);
  const r = rankFor(stars);
  return (
    <div className="screen">
      <Header title="Rank" onBack={onBack} />
      <div className="list">
        {RANKS.map((x) => (
          <div key={x.name} className={`shift-row ${x.name === r.rank ? 'boss' : ''}`} style={{ opacity: stars >= x.at ? 1 : 0.5 }}>
            <Icon name="crown" size={20} />
            <span style={{ flex: 1, fontWeight: 600 }}>{x.name}</span>
            <span className="dim">{x.at}★</span>
          </div>
        ))}
      </div>
      <p className="dim small">You have {stars} of {TOTAL_STARS} stars.</p>
    </div>
  );
}

export function SettingsScreen({ save, onChange, onBack, onReset }: { save: SaveData; onChange: (s: Settings) => void; onBack: () => void; onReset: () => void }) {
  const s = save.settings;
  const [confirm, setConfirm] = useState(false);
  const deviceRM = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const T = ({ k, label, sub }: { k: keyof Settings; label: string; sub?: string }) => {
    const val = k === 'reduceMotion' ? (s.reduceMotion ?? deviceRM) : !!s[k];
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
        <T k="fewerLapses" label="Fewer lapses" sub="Halves the chance of a brainless moment" />
        <T k="longerPatience" label="Longer patience" sub="Demands last 35 seconds" />
        <T k="largerCaptions" label="Larger captions" />
        <T k="reduceMotion" label="Reduce motion" sub={s.reduceMotion === null ? 'Following the device' : undefined} />
      </div>
      <div className="col" style={{ marginTop: 16 }}>
        {!confirm ? (
          <button className="btn secondary" onClick={() => setConfirm(true)}>Reset progress</button>
        ) : (
          <div className="card col">
            <div>Erase all stars, training, thrones and reviews? This cannot be undone.</div>
            <button className="btn danger" onClick={() => { setConfirm(false); onReset(); }}>Yes, reset everything</button>
            <button className="btn secondary" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        )}
      </div>
      <p className="dim small" style={{ marginTop: 18 }}>{APP.displayName} · {APP.appId}. No personal data is collected and nothing leaves the device.</p>
    </div>
  );
}

export function DailyIntro({ save, onPlay, onBack }: { save: SaveData; onPlay: () => void; onBack: () => void }) {
  const key = dateKey(new Date());
  const def = dailyShift(key);
  const m = MODIFIERS.find((x) => x.id === def.modifiers![0])!;
  const done = save.daily.history[key] !== undefined;
  return (
    <div className="screen">
      <Header title="The Daily Grievance" onBack={onBack} />
      <div className="card col">
        <span className="chip">{prettyDate(key)}</span>
        <h2>{m.name}</h2>
        <div className="dim">{m.blurb}</div>
        <div className="small">{ROOMS[def.room].name} · {objectiveText(def)} · everyone’s staff trained to 40</div>
        {done && <div className="small">Today’s score: <b>{save.daily.history[key]}</b>. Further attempts are practice.</div>}
        <div className="small dim">Streak: {save.daily.streak} day{save.daily.streak === 1 ? '' : 's'}</div>
      </div>
      <div className="col" style={{ marginTop: 16 }}>
        <button className="btn violet" onClick={onPlay}>{done ? 'Practise' : 'Begin'}</button>
      </div>
    </div>
  );
}
