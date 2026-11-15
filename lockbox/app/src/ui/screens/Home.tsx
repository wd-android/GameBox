import { useState } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { CHAPTERS } from '../../chest/chest';
import { chapterUnlocked, currentStreak, dailyText, dateKey, nextChest, openedIn, rank } from '../../game/progress';
import { TUNING } from '../../config/tuning';
import { useStore } from '../store';
import { resume, sessionRoute, startChest, startDaily } from '../flow';
import { ChestArt, Coins } from '../parts';
import { SettingsSheet } from './Sheets';

export function Home() {
  const { save, go, commit } = useStore();
  const [settings, setSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const r = rank(save);
  const today = dateKey();
  const done = save.daily.history[today];
  const streak = currentStreak(save, today);
  const inProgress = resume(save);
  const next = nextChest(save);

  const cont = () => {
    if (inProgress) return go(sessionRoute(inProgress));
    if (next) {
      go(startChest(save, next, save.settings.preferredMode));
      commit();
    }
  };
  const copy = async () => {
    const text = dailyText(today, done!.tries);
    try {
      await Clipboard.write({ string: text });
    } catch {
      await navigator.clipboard?.writeText(text).catch(() => undefined);
    }
    setCopied(true);
  };

  return (
    <div className="screen home">
      <div className="topbar">
        <Coins n={save.coins} />
        <span className="spacer" />
        <span className="chip">🔥 {streak}</span>
        <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Settings">
          ⚙
        </button>
      </div>
      <div className="hero">
        <ChestArt tier="gold" size={190} glow />
        <h1 className="title">Lockbox</h1>
        <div className="rank">
          <b>{r.name}</b>
          <span className="subtitle">
            {r.stars} gold star{r.stars === 1 ? '' : 's'}
            {r.next !== null && ` · ${r.next - r.stars} to the next rank`}
          </span>
        </div>
      </div>
      <div className="home-actions">
        {(inProgress || next) && (
          <button className="btn primary wide" onClick={cont}>
            {inProgress ? 'Continue' : `Continue · Chest ${next!.index}`}
          </button>
        )}
        {done ? (
          <div className="card daily-done">
            <div>
              <b>Daily Safe opened</b>
              <span className="subtitle"> in {done.tries} tries</span>
            </div>
            <button className="btn secondary" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        ) : (
          <button
            className="btn secondary wide"
            onClick={() => {
              go(startDaily(save));
              commit();
            }}
          >
            Daily Safe
          </button>
        )}
        <div className="two">
          <button className="btn secondary" onClick={() => go({ name: 'chapters' })}>
            Chapters
          </button>
          <button className="btn secondary" onClick={() => go({ name: 'vault' })}>
            Vault
          </button>
        </div>
      </div>
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
    </div>
  );
}

export function Chapters() {
  const { save, go } = useStore();
  return (
    <div className="screen chapters">
      <div className="topbar">
        <button className="icon-btn" onClick={() => go({ name: 'home' })} aria-label="Back">
          ‹
        </button>
        <span className="title small">Chapters</span>
      </div>
      <div className="chapter-list">
        {CHAPTERS.map((ch) => {
          const open = chapterUnlocked(save, ch.id);
          const n = openedIn(save, ch.id);
          return (
            <button key={ch.id} className={`card chapter-card ch${ch.id}${open ? '' : ' locked'}`} onClick={() => open && go({ name: 'chapter', id: ch.id })}>
              <span className="chapter-num">Chapter {ch.id}</span>
              <b>{ch.name}</b>
              <span className="subtitle">{ch.blurb}</span>
              <span className="chapter-progress">
                {open ? `${n} of ${ch.chests.length} chests opened` : `Open ${TUNING.CHAPTER2_UNLOCK} chests in The Attic to unlock (${openedIn(save, 1)} so far)`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
