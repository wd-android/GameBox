import { useState } from 'react';
import type { ChestSession } from '../../game/session';
import { useStore } from '../store';
import { ChestArt, INFO_NAMES, LockIcon, Stars, TYPE_NAMES } from '../parts';
import { PauseSheet } from './Sheets';

/** The whole chest with its locks (§12). Solved locks hang open; tap any lock to work on it. */
export function ChestScreen({ session }: { session: ChestSession }) {
  const { go } = useStore();
  const [paused, setPaused] = useState(false);
  const c = session.chest;
  const title = c.id.startsWith('daily-') ? 'Daily Safe' : `Chest ${c.index}`;
  return (
    <div className="screen chest-screen">
      <div className="topbar">
        <span className="title small">{title}</span>
        <span className="spacer" />
        <span className={`chip mode-chip ${session.mode}`}>{session.mode === 'locksmith' ? 'Locksmith' : session.mode === 'daily' ? 'Daily Safe' : 'Relaxed'}</span>
      </div>
      <div className="chest-stage">
        <ChestArt tier={c.tier} size={300} />
        <div className="chest-locks">
          {c.locks.map((spec, i) => {
            const l = session.locks[i];
            return (
              <button key={i} className={`chest-lock${l.solved ? ' solved' : ''}${l.jammed ? ' jammed' : ''}`} onClick={() => go({ name: 'lock', session, index: i })}>
                <LockIcon type={spec.type} open={l.solved} size={64} />
                <span className="chest-lock-name">{TYPE_NAMES[spec.type]}</span>
                <small>{l.solved ? <Stars n={l.stars} kind={session.mode === 'locksmith' ? 'gold' : 'silver'} /> : l.jammed ? 'Jammed' : INFO_NAMES[spec.information]}</small>
              </button>
            );
          })}
        </div>
      </div>
      <p className="subtitle center">Open every lock, in any order.</p>
      <div className="bottom-bar">
        <button className="icon-btn big" onClick={() => setPaused(true)} aria-label="Pause">
          ❚❚
        </button>
      </div>
      {paused && <PauseSheet session={session} onClose={() => setPaused(false)} />}
    </div>
  );
}
