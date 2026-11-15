import { useEffect, useRef, useState } from 'react';
import { TUNING } from '../../config/tuning';
import type { ChestSession } from '../../game/session';
import { detailFor } from '../../game/rules';
import type { Feedback } from '../../locks/types';
import { sound } from '../../audio/sound';
import { haptic } from '../../audio/haptics';
import { DEBUG, useStore } from '../store';
import { finishChest, sessionRoute } from '../flow';
import { PadlockView } from '../locks/PadlockView';
import { BottlesView, BottleIcon } from '../locks/BottlesView';
import { RingsView } from '../locks/RingsView';
import { BoltsView } from '../locks/BoltsView';
import { Coins, Stars, TYPE_NAMES } from '../parts';
import { PauseSheet } from './Sheets';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function HistoryRow({ entry, symbols }: { entry: Any; symbols: boolean }) {
  const fb: Feedback = entry.feedback;
  return (
    <li className="history-row">
      <span className="history-code">
        {entry.code
          ? entry.code.map((d: number, k: number) => (
              <i key={k} className={fb.which?.[k] ? 'lit' : ''}>
                {d}
              </i>
            ))
          : entry.order.map((id: number, k: number) => (
              <span key={k} className={`history-bottle${fb.which?.[k] ? ' lit' : ''}`}>
                <BottleIcon id={id} size={22} symbols={symbols} />
              </span>
            ))}
      </span>
      <span className="history-text">{fb.text}</span>
    </li>
  );
}

/** One lock (§12): the lock fills the upper two-thirds; controls and history sit in the lower third. */
export function LockScreen({ session, index }: { session: ChestSession; index: number }) {
  const { save, go, commit } = useStore();
  const [rattle, setRattle] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [hintMove, setHintMove] = useState<Any>(null);
  const [paused, setPaused] = useState(false);
  const [justOpened, setJustOpened] = useState(false);
  const timer = useRef<number>(0);

  const spec = session.chest.locks[index];
  const puzzle = session.puzzles[index];
  const lock = session.locks[index];
  const state = lock.state;
  const settings = save.settings;
  const detail = detailFor(session.mode, settings.detail);
  const attemptBased = spec.type === 'padlock' || spec.type === 'bottles';
  const limit = session.limit(index);
  const par = session.par(index, settings.detail);
  const multi = session.chest.locks.length > 1;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const persist = () => {
    save.inProgress = session.serialize();
    commit();
  };

  const flash = (text: string) => {
    setMessage(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2600);
  };

  const onSolved = () => {
    sound.snap();
    haptic.firm();
    setJustOpened(true);
    persist();
    window.setTimeout(() => {
      if (session.open) {
        go(finishChest(save, session));
        commit();
      } else go(sessionRoute(session));
    }, settings.reduceMotion ? 500 : 1100);
  };

  const doMove = (m: Any) => {
    if (lock.solved || lock.jammed) return;
    const r = session.move(index, m);
    setHintMove(null);
    persist();
    if (r.solved) onSolved();
    else if (session.locks[index].jammed) {
      sound.rattle();
      haptic.double();
    }
  };

  const doTry = () => {
    if (!attemptBased || lock.solved || lock.jammed) return;
    const fb = session.attempt(index, settings.detail);
    if (fb.solved) {
      onSolved();
      return;
    }
    persist();
    sound.rattle();
    haptic.double();
    setRattle(true);
    window.setTimeout(() => setRattle(false), 420);
    if (fb.which?.some(Boolean)) {
      window.setTimeout(() => {
        sound.warm();
        haptic.light();
      }, 260);
    }
  };

  const doHint = (kind: 'nudge' | 'clue') => {
    const cost = kind === 'nudge' ? TUNING.NUDGE_COST : TUNING.CLUE_COST;
    if (save.coins < cost) {
      flash(`You need ${cost} coins for this hint.`);
      return;
    }
    const h = session.hint(index, kind);
    if (!h) {
      flash('No more help to give here.');
      return;
    }
    save.coins -= cost;
    sound.chime();
    haptic.light();
    if (h.move) setHintMove(h.move);
    flash(h.message);
    persist();
  };

  if (DEBUG) Object.assign(window, { __lbMove: doMove, __lbTry: doTry });

  const retry = () => {
    session.retryFresh();
    setHintMove(null);
    persist();
  };

  // "Which" lights: shown on the last try's correct parts until that part changes.
  const last: Any = attemptBased ? state.history[state.history.length - 1] : null;
  const lit: boolean[] = (() => {
    if (!last?.feedback.which) return new Array(spec.parts).fill(false);
    const now = state.wheels ?? state.order;
    const then = last.code ?? last.order;
    return last.feedback.which.map((w: boolean, k: number) => w && now[k] === then[k]);
  })();

  const view = (() => {
    switch (spec.type) {
      case 'padlock':
        return <PadlockView puzzle={puzzle} state={state} solved={lock.solved} rattle={rattle} lit={lit} onTry={doTry} onTurn={(w, d) => doMove({ kind: 'turn', wheel: w, delta: d })} />;
      case 'bottles':
        return <BottlesView puzzle={puzzle} state={state} solved={lock.solved} rattle={rattle} lit={lit} symbols={settings.symbols} onTry={doTry} onSwap={(i, j) => doMove({ kind: 'swap', i, j })} />;
      case 'rings':
        return <RingsView puzzle={puzzle} state={state} solved={lock.solved} which={detail === 'which'} symbols={settings.symbols} hintMove={hintMove} onTurn={(ring, dir) => doMove({ kind: 'turn', ring, dir })} />;
      case 'bolts':
        return <BoltsView puzzle={puzzle} state={state} solved={lock.solved} hintMove={hintMove} onSlide={(bolt, to) => doMove({ kind: 'slide', bolt, to })} />;
    }
  })();

  const countWord = attemptBased ? 'Tries' : spec.type === 'rings' ? 'Turns' : 'Slides';
  const goal = attemptBased ? (spec.information === 'feedback' ? `par ${par}` : spec.information === 'full' ? 'match the code' : 'work it out, then try') : `best ${puzzle.shortest}`;
  const first = session.chest.id === 'c1-1' && lock.count === 0;

  return (
    <div className={`screen lock-screen type-${spec.type}`}>
      <div className="lock-head">
        <span className="chip">{TYPE_NAMES[spec.type]}{multi ? ` · ${index + 1} of ${session.chest.locks.length}` : ''}</span>
        <span className={`chip mode-chip ${session.mode}`}>{session.mode === 'locksmith' ? 'Locksmith' : session.mode === 'daily' ? 'Daily Safe' : 'Relaxed'}</span>
        <span className="spacer" />
        <Coins n={save.coins} />
      </div>

      <div className="lock-stage">{view}</div>

      {message && <div className="toast" role="status">{message}</div>}

      <div className="lock-panel card">
        {lock.jammed ? (
          <div className="jammed">
            <b>The lock has jammed.</b>
            <span className="subtitle">Try the chest again with a fresh puzzle of the same difficulty.</span>
            <button className="btn primary" onClick={retry}>
              Try a fresh chest
            </button>
          </div>
        ) : lock.solved ? (
          <div className="solved-line">
            <b>{justOpened ? 'Open!' : 'This lock is open.'}</b>
            <Stars n={lock.stars} kind={session.mode === 'locksmith' ? 'gold' : 'silver'} />
          </div>
        ) : (
          <>
            <div className="counter-row">
              <span>
                {countWord}: <b>{lock.count}</b>
                {limit !== null && <span className="limit"> · {Math.max(0, limit - lock.count)} left</span>}
              </span>
              <span className="subtitle">{goal}</span>
            </div>
            {first && <div className="lock-coach">Drag each wheel up or down to match the code, then tap Try.</div>}
            {first ? null : !attemptBased ? (
              <div className="history-empty">{spec.type === 'rings' ? 'Drag a ring round to turn it. The lock opens when the picture is whole.' : 'Drag a bolt along its length. Slide the brass latch out to the right.'}</div>
            ) : state.history.length === 0 ? (
              <div className="history-empty">{spec.information === 'feedback' ? 'Each try tells you something. Your tries will be listed here.' : spec.type === 'bottles' ? 'Drag a bottle onto another to swap them, then pull the lever.' : 'Turn the wheels, then tap Try or the shackle.'}</div>
            ) : null}
            {attemptBased && state.history.length > 0 && (
              <ol className="history" aria-label="Earlier tries">
                {[...state.history].reverse().map((h: Any, k: number) => (
                  <HistoryRow key={state.history.length - k} entry={h} symbols={settings.symbols} />
                ))}
              </ol>
            )}
          </>
        )}
        <div className="lock-buttons">
          <button className="icon-btn big" onClick={() => setPaused(true)} aria-label="Pause">
            ❚❚
          </button>
          {session.mode !== 'daily' && !lock.solved && !lock.jammed && (
            <>
              <button className="hint-btn" disabled={!session.canHint(index, 'nudge')} onClick={() => doHint('nudge')}>
                Nudge <small>{TUNING.NUDGE_COST}</small>
              </button>
              {attemptBased && (
                <button className="hint-btn" disabled={!session.canHint(index, 'clue')} onClick={() => doHint('clue')}>
                  Clue <small>{TUNING.CLUE_COST}</small>
                </button>
              )}
            </>
          )}
          <span className="spacer" />
          {attemptBased && !lock.solved && !lock.jammed && (
            <button className="btn primary try-btn" onClick={doTry}>
              Try
            </button>
          )}
          {multi && (lock.solved || lock.jammed) && !justOpened && (
            <button className="btn secondary" onClick={() => go({ name: 'chest', session })}>
              Back to chest
            </button>
          )}
        </div>
      </div>

      {paused && (
        <PauseSheet
          session={session}
          onClose={() => setPaused(false)}
          onChest={multi ? () => go({ name: 'chest', session }) : undefined}
        />
      )}
    </div>
  );
}
