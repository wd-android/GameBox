import { useState } from 'react';
import type { ChestSession } from '../../game/session';
import { freshSave, type Settings } from '../../state/save';
import { useStore } from '../store';
import { Toggle } from '../parts';

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange(v: T): void }) {
  return (
    <div className="segmented">
      {options.map(([v, label]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Settings (§14). Changes apply immediately; feedback detail applies from the next try. */
export function SettingsBody({ inGame = false }: { inGame?: boolean }) {
  const { save, commit, setSave, go } = useStore();
  const [confirm, setConfirm] = useState(false);
  const s = save.settings;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    s[k] = v;
    commit();
  };
  return (
    <div className="settings">
      <div className="setting-block">
        <span>After each try, show…</span>
        <Segmented value={s.detail} options={[['howMany', 'How many are correct'], ['which', 'Which are correct']]} onChange={(v) => set('detail', v)} />
        <small className="subtitle">Relaxed mode only. Locksmith and the Daily Safe always show how many.</small>
      </div>
      {!inGame && (
        <div className="row">
          <span>New chests in</span>
          <Segmented value={s.preferredMode} options={[['relaxed', 'Relaxed'], ['locksmith', 'Locksmith']]} onChange={(v) => set('preferredMode', v)} />
        </div>
      )}
      <div className="row">
        <span>Music</span>
        <Toggle label="Music" on={s.music} onChange={(v) => set('music', v)} />
      </div>
      <div className="row">
        <span>Sound effects</span>
        <Toggle label="Sound effects" on={s.sfx} onChange={(v) => set('sfx', v)} />
      </div>
      <div className="row">
        <span>Vibration</span>
        <Toggle label="Vibration" on={s.vibration} onChange={(v) => set('vibration', v)} />
      </div>
      <div className="row">
        <span>Symbols on bottles and lights</span>
        <Toggle label="Symbols on bottles and lights" on={s.symbols} onChange={(v) => set('symbols', v)} />
      </div>
      <div className="row">
        <span>Large clue text</span>
        <Toggle label="Large clue text" on={s.largeClues} onChange={(v) => set('largeClues', v)} />
      </div>
      <div className="row">
        <span>Reduce motion</span>
        <Toggle label="Reduce motion" on={s.reduceMotion} onChange={(v) => set('reduceMotion', v)} />
      </div>
      {!inGame &&
        (confirm ? (
          <div className="confirm card">
            <b>Reset all progress?</b>
            <span className="subtitle">Stars, coins, trinkets and the Daily Safe streak will be lost.</span>
            <div className="row">
              <button className="btn ghost" onClick={() => setConfirm(false)}>
                Keep
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  const fresh = freshSave();
                  fresh.settings = { ...s };
                  fresh.firstChestsDone = 3;
                  setSave(fresh);
                  setConfirm(false);
                  go({ name: 'home' });
                }}
              >
                Reset
              </button>
            </div>
          </div>
        ) : (
          <button className="btn ghost wide" onClick={() => setConfirm(true)}>
            Reset progress
          </button>
        ))}
    </div>
  );
}

export function SettingsSheet({ onClose }: { onClose(): void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet card" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <SettingsBody />
      </div>
    </div>
  );
}

/** Pause: resume, the feedback setting, and leaving the chest (progress is kept). */
export function PauseSheet({ session, onClose, onChest }: { session: ChestSession; onClose(): void; onChest?: () => void }) {
  const { go, save } = useStore();
  const chapter = session.chest.chapter;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet card" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Paused</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <button className="btn primary wide" onClick={onClose}>
          Resume
        </button>
        {onChest && (
          <button className="btn secondary wide" onClick={onChest}>
            Back to the chest
          </button>
        )}
        {save.firstChestsDone >= 3 && (
          <button
            className="btn secondary wide"
            onClick={() => go(session.mode === 'daily' ? { name: 'home' } : { name: 'chapter', id: chapter })}
          >
            Leave (progress is kept)
          </button>
        )}
        <SettingsBody inGame />
      </div>
    </div>
  );
}
