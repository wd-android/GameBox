import { useState } from 'react';
import { CHAPTERS } from '../../chest/chest';
import { RARES, SETS, trinket } from '../../chest/trinkets';
import { sound } from '../../audio/sound';
import { haptic } from '../../audio/haptics';
import { useStore } from '../store';
import { ChestArt, TrinketToken } from '../parts';

/** The Vault (§11): every opened chest and collected trinket. Drag trinkets between shelves; the arrangement is saved. */
export function Vault() {
  const { save, go, commit } = useStore();
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const dropAt = (x: number, y: number): { shelf: number; index: number } | null => {
    const el = document.elementFromPoint(x, y);
    const shelfEl = el?.closest('[data-shelf]') as HTMLElement | null;
    if (!shelfEl) return null;
    const shelf = Number(shelfEl.dataset.shelf);
    const tokens = [...shelfEl.querySelectorAll('[data-token]')] as HTMLElement[];
    let index = tokens.length;
    for (let k = 0; k < tokens.length; k++) {
      const r = tokens[k].getBoundingClientRect();
      if (y < r.top - 6 || (y < r.bottom + 6 && x < r.left + r.width / 2)) {
        index = k;
        break;
      }
    }
    return { shelf, index };
  };

  const moveTo = (id: string, shelf: number, index: number) => {
    const v = save.vault;
    let from = -1;
    let fromIdx = -1;
    v.forEach((s, k) => {
      const i = s.indexOf(id);
      if (i >= 0) {
        from = k;
        fromIdx = i;
      }
    });
    if (from < 0) return;
    v[from].splice(fromIdx, 1);
    if (from === shelf && fromIdx < index) index--;
    v[shelf].splice(index, 0, id);
    sound.knock();
    haptic.tick();
    commit();
  };

  const down = (id: string) => (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return;
      moved = true;
      setDrag({ id, x: ev.clientX, y: ev.clientY });
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      setDrag(null);
      if (!moved) {
        setSelected((s) => (s === id ? null : id));
        return;
      }
      const t = dropAt(ev.clientX, ev.clientY);
      if (t) moveTo(id, t.shelf, t.index);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const opened = CHAPTERS.map((ch) => ch.chests.filter((c) => save.chests[c.id]?.rewardTaken));
  const sel = selected ? trinket(selected) : null;

  return (
    <div className="screen vault">
      <div className="topbar">
        <button className="icon-btn" onClick={() => go({ name: 'home' })} aria-label="Back">
          ‹
        </button>
        <span className="title small">Vault</span>
        <span className="spacer" />
        <span className="chip">{save.trinkets.length} trinkets</span>
      </div>
      <div className="vault-scroll">
        <div className="vault-room">
          {save.vault.map((shelf, k) => (
            <div key={k} className={`vault-shelf${drag ? ' drop' : ''}`} data-shelf={k}>
              {shelf.map((id) => (
                <span key={id} data-token className={`token-wrap${drag?.id === id ? ' ghost' : ''}${selected === id ? ' selected' : ''}`} onPointerDown={down(id)}>
                  <TrinketToken id={id} size={50} />
                </span>
              ))}
              {shelf.length === 0 && <span className="empty">{save.trinkets.length ? 'Drag trinkets here' : 'Trinkets from chests will sit here'}</span>}
            </div>
          ))}
        </div>
        {sel && (
          <div className="card trinket-info">
            <b>{sel.name}</b>
            <span className="subtitle">{sel.rare ? 'Rare find' : SETS.find((s) => s.id === sel.set)?.name}</span>
          </div>
        )}
        <h3 className="section-title">Sets</h3>
        <div className="sets">
          {SETS.map((s) => {
            const have = s.items.filter((it) => save.trinkets.includes(it.id)).length;
            return (
              <div key={s.id} className={`card set-row${save.setsDone.includes(s.id) ? ' complete' : ''}`}>
                <div className="set-head">
                  <b>{s.name}</b>
                  <span className="subtitle">
                    {have} / {s.items.length}
                    {save.setsDone.includes(s.id) ? ' · complete' : ` · chapter ${s.chapter}`}
                  </span>
                </div>
                <div className="set-items">
                  {s.items.map((it) => (save.trinkets.includes(it.id) ? <TrinketToken key={it.id} id={it.id} size={30} /> : <span key={it.id} className="slot-empty" />))}
                </div>
              </div>
            );
          })}
          <div className="card set-row">
            <div className="set-head">
              <b>Rare finds</b>
              <span className="subtitle">
                {RARES.filter((r) => save.trinkets.includes(r.id)).length} / {RARES.length}
              </span>
            </div>
          </div>
        </div>
        <h3 className="section-title">Opened chests</h3>
        {CHAPTERS.map((ch, k) => (
          <div key={ch.id} className="card chests-row">
            <b>
              {ch.name} · {opened[k].length} / {ch.chests.length}
            </b>
            <div className="mini-chests">
              {opened[k].map((c) => (
                <ChestArt key={c.id} tier={c.tier} size={34} open />
              ))}
            </div>
          </div>
        ))}
      </div>
      {drag && (
        <div className="drag-token" style={{ left: drag.x - 30, top: drag.y - 30 }}>
          <TrinketToken id={drag.id} size={60} />
        </div>
      )}
    </div>
  );
}
