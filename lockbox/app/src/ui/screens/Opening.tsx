import { useEffect, useState } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import type { ChestSession } from '../../game/session';
import { currentStreak, dailyText, nextChest, type OpenOutcome } from '../../game/progress';
import { trinket } from '../../chest/trinkets';
import { sound } from '../../audio/sound';
import { haptic } from '../../audio/haptics';
import { useStore } from '../store';
import { startChest } from '../flow';
import { ChestArt, Stars, TrinketToken } from '../parts';

/** The reward sequence (§9.2): the lid lifts, light spills out, and the contents rise one at a time. */
export function Opening({ session, outcome, dailyKey }: { session: ChestSession; outcome: OpenOutcome; dailyKey?: string }) {
  const { save, go, commit } = useStore();
  const [shown, setShown] = useState(0);
  const [copied, setCopied] = useState(false);
  const reduce = save.settings.reduceMotion;
  const items: { key: string; node: JSX.Element; label: string }[] = [];
  if (!dailyKey) {
    items.push({ key: 'coins', label: `${outcome.coins} coins${outcome.first ? '' : ' (replay)'}`, node: <span className="coin big" /> });
    if (outcome.first && outcome.reward.trinket) items.push({ key: 't', label: trinket(outcome.reward.trinket)?.name ?? '', node: <TrinketToken id={outcome.reward.trinket} size={72} /> });
    if (outcome.first && outcome.reward.rare) items.push({ key: 'r', label: `Rare: ${trinket(outcome.reward.rare)?.name ?? ''}`, node: <TrinketToken id={outcome.reward.rare} size={72} /> });
    for (const s of outcome.setsCompleted) items.push({ key: s, label: `${s} complete! +100 coins`, node: <span className="set-badge">★</span> });
  }

  useEffect(() => {
    const start = reduce ? 300 : 1200;
    const gap = reduce ? 250 : 700;
    const timers = items.map((_, i) =>
      window.setTimeout(() => {
        setShown(i + 1);
        sound.chime();
        haptic.light();
      }, start + i * gap),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tries = session.totalTries;
  const text = dailyKey ? dailyText(dailyKey, tries) : '';
  const copy = async () => {
    try {
      await Clipboard.write({ string: text });
    } catch {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        /* nothing to do */
      }
    }
    setCopied(true);
  };

  const next = nextChest(save);
  const menuReady = save.firstChestsDone >= 3;
  const goNext = () => {
    if (!next) return go({ name: 'home' });
    go(startChest(save, next, menuReady ? save.settings.preferredMode : 'relaxed'));
    commit();
  };
  const isLocksmith = session.mode === 'locksmith';

  return (
    <div className={`screen opening${reduce ? ' calm' : ''}`}>
      <div className="opening-stage">
        <ChestArt tier={session.chest.tier} open size={280} />
        <div className="rising">
          {items.slice(0, shown).map((it) => (
            <div key={it.key} className="rise">
              {it.node}
              <span>{it.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="opening-panel card">
        {dailyKey ? (
          <>
            <b className="big-line">Opened in {tries} tries</b>
            <span className="subtitle">Streak: {currentStreak(save, dailyKey)} day{currentStreak(save, dailyKey) === 1 ? '' : 's'}</span>
            <div className="share-preview">{text}</div>
            <button className="btn secondary wide" onClick={copy}>
              {copied ? 'Copied' : 'Copy result'}
            </button>
            <button className="btn primary wide" onClick={() => go({ name: 'home' })}>
              Home
            </button>
          </>
        ) : (
          <>
            <Stars n={session.stars} kind={isLocksmith ? 'gold' : 'silver'} size={38} />
            <span className="subtitle">
              {isLocksmith ? 'Gold stars count towards your rank.' : 'Silver stars. Open it in Locksmith mode for gold.'}
              {outcome.newBest && ' New best!'}
            </span>
            <button className="btn primary wide" onClick={goNext}>
              {next ? 'Next chest' : 'Home'}
            </button>
            {menuReady && (
              <button className="btn ghost wide" onClick={() => go({ name: 'chapter', id: session.chest.chapter })}>
                Chapter map
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
