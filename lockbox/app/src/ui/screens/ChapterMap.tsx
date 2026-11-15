import { useEffect, useRef, useState } from 'react';
import { CHAPTERS, type ChestDef } from '../../chest/chest';
import { chestUnlocked } from '../../game/progress';
import type { Mode } from '../../game/rules';
import { useStore } from '../store';
import { resume, sessionRoute, startChest } from '../flow';
import { ChestArt, INFO_NAMES, LockIcon, Stars, TYPE_NAMES } from '../parts';

const ROW = 104;

/** The 30 chests along a winding path through the chapter's setting, with silver and gold stars (§12). */
export function ChapterMap({ id }: { id: number }) {
  const { save, go, commit } = useStore();
  const ch = CHAPTERS[id - 1];
  const [pick, setPick] = useState<ChestDef | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const width = 340;
  const xs = ch.chests.map((_, i) => width / 2 + Math.sin(i * 0.9) * 110);
  const height = ch.chests.length * ROW + 80;
  // Chest 1 is at the bottom; the path climbs.
  const y = (i: number) => height - 70 - i * ROW;
  const path = ch.chests.map((_, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(0)} ${y(i)}`).join(' ');
  const current = ch.chests.findIndex((c) => chestUnlocked(save, c) && !save.chests[c.id]?.rewardTaken);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = current >= 0 ? y(current) : y(0);
    el.scrollTop = Math.max(0, target - el.clientHeight / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = (c: ChestDef, mode: Mode) => {
    const ip = resume(save);
    if (ip && ip.chest.id === c.id && ip.mode === mode) go(sessionRoute(ip));
    else go(startChest(save, c, mode));
    commit();
  };

  return (
    <div className={`screen map-screen ch${id}`}>
      <div className="topbar">
        <button className="icon-btn" onClick={() => go({ name: 'chapters' })} aria-label="Back">
          ‹
        </button>
        <span className="title small">{ch.name}</span>
      </div>
      <div className="map-scroll" ref={scroller}>
        <div className="map" style={{ height, width }}>
          <svg width={width} height={height} className="map-path" aria-hidden>
            <path d={path} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
            <path d={path} fill="none" stroke="rgba(246,146,30,.55)" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
          </svg>
          {ch.chests.map((c, i) => {
            const rec = save.chests[c.id];
            const unlocked = chestUnlocked(save, c);
            return (
              <button
                key={c.id}
                className={`map-node${unlocked ? '' : ' locked'}${i === current ? ' current' : ''}${rec?.rewardTaken ? ' done' : ''}`}
                style={{ left: xs[i] - 46, top: y(i) - 46 }}
                onClick={() => unlocked && setPick(c)}
                aria-label={`Chest ${c.index}${unlocked ? '' : ', locked'}`}
              >
                <ChestArt tier={c.tier} size={66} open={!!rec?.rewardTaken} />
                <span className="node-num">{c.index}</span>
                {rec && (
                  <span className="node-stars">
                    <Stars n={rec.silver} kind="silver" size={11} />
                    <Stars n={rec.gold} kind="gold" size={11} />
                  </span>
                )}
                {!unlocked && <span className="node-lock">🔒</span>}
              </button>
            );
          })}
        </div>
      </div>
      {pick && (
        <div className="overlay" onClick={() => setPick(null)}>
          <div className="sheet card chest-pick" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>Chest {pick.index}</h2>
              <span className={`chip tier ${pick.tier}`}>{pick.tier}</span>
            </div>
            <div className="pick-locks">
              {pick.locks.map((l, k) => (
                <div key={k} className="pick-lock">
                  <LockIcon type={l.type} size={44} />
                  <span>
                    {TYPE_NAMES[l.type]} · {l.type === 'bolts' ? `${l.parts} bolts` : l.type === 'rings' ? `${l.parts} rings` : `${l.parts} ${l.type === 'padlock' ? 'wheels' : 'bottles'}`}
                    <small className="subtitle"> · {INFO_NAMES[l.information]}</small>
                  </span>
                </div>
              ))}
            </div>
            <div className="row">
              <span>Best</span>
              <span>
                <Stars n={save.chests[pick.id]?.silver ?? 0} kind="silver" /> <Stars n={save.chests[pick.id]?.gold ?? 0} kind="gold" />
              </span>
            </div>
            <button className={`btn wide ${save.settings.preferredMode === 'relaxed' ? 'primary' : 'secondary'}`} onClick={() => begin(pick, 'relaxed')}>
              Relaxed · unlimited tries
            </button>
            <button className={`btn wide ${save.settings.preferredMode === 'locksmith' ? 'primary' : 'secondary'}`} onClick={() => begin(pick, 'locksmith')}>
              Locksmith · limited, gold stars
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
