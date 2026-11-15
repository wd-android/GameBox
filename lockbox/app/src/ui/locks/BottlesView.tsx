import { useRef, useState } from 'react';
import { BOTTLES, bottleClueText, type BottleClue, type BottlesPuzzle, type BottlesState } from '../../locks/bottles/bottles';
import { sound } from '../../audio/sound';
import { haptic } from '../../audio/haptics';
import { ClueCard } from './common';

/** Each bottle differs in silhouette as well as colour, and carries a symbol (§6.2). */
const SHAPES: Record<string, string> = {
  round: 'M22 6h16v14c10 4 16 12 16 24v34a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8V44c0-12 6-20 16-24Z',
  tall: 'M24 4h12v18c4 2 6 6 6 10v48a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V32c0-4 2-8 6-10Z',
  square: 'M23 6h14v12h8a5 5 0 0 1 5 5v55a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V23a5 5 0 0 1 5-5h8Z',
  flask: 'M24 4h12v26l18 40a10 10 0 0 1-9 16H15a10 10 0 0 1-9-16l18-40Z',
  gourd: 'M24 4h12v12c6 2 9 7 9 13 0 5-3 9-6 11 9 4 15 12 15 22 0 14-11 24-24 24S6 76 6 62c0-10 6-18 15-22-3-2-6-6-6-11 0-6 3-11 9-13Z',
  jug: 'M22 6h16v10c8 4 14 12 14 22v40a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8V38c0-10 6-18 14-22Zm30 26c8 0 8 22 0 22',
  slim: 'M26 4h8v26c4 4 6 8 6 14v36a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6V44c0-6 2-10 6-14Z',
  potion: 'M24 4h12v20c12 4 20 14 20 28 0 18-12 34-26 34S4 70 4 52c0-14 8-24 20-28Z',
};

export function BottleIcon({ id, size = 32, symbols = true }: { id: number; size?: number; symbols?: boolean }) {
  const b = BOTTLES[id];
  return (
    <svg viewBox="0 0 60 90" width={size * 0.67} height={size} aria-label={b.name} role="img">
      <path d={SHAPES[b.shape]} fill={b.colour} stroke="#1b043b" strokeWidth="2.5" />
      {symbols && (
        <text x="30" y="62" textAnchor="middle" fontSize="20" fill="#1b043b">
          {b.symbol}
        </text>
      )}
    </svg>
  );
}

interface Props {
  puzzle: BottlesPuzzle;
  state: BottlesState;
  solved: boolean;
  symbols: boolean;
  lit: boolean[];
  rattle: boolean;
  onSwap(i: number, j: number): void;
  onTry(): void;
}

function ClueLine({ c, symbols }: { c: BottleClue; symbols: boolean }) {
  const ids = [c.a, ...('b' in c ? [c.b] : []), ...('c' in c ? [c.c] : [])];
  return (
    <div className="clue-row">
      <span className="clue-icons">{ids.map((id, k) => <BottleIcon key={k} id={id} size={26} symbols={symbols} />)}</span>
      <span>{bottleClueText(c)}</span>
    </div>
  );
}

/** Coloured bottles (§6.2): drag a bottle onto another to swap them; pull the lever to try. */
export function BottlesView({ puzzle, state, solved, symbols, lit, rattle, onSwap, onTry }: Props) {
  const [drag, setDrag] = useState<{ from: number; dx: number; dy: number; over: number | null } | null>(null);
  const shelf = useRef<HTMLDivElement>(null);
  const slotAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest('[data-slot]') as HTMLElement | null;
    return el ? Number(el.dataset.slot) : null;
  };
  const down = (i: number) => (e: React.PointerEvent) => {
    if (state.fixed[i] || solved) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const y0 = e.clientY;
    sound.clink();
    haptic.tick();
    setDrag({ from: i, dx: 0, dy: 0, over: null });
    const move = (ev: PointerEvent) => {
      el.style.pointerEvents = 'none';
      const over = slotAt(ev.clientX, ev.clientY);
      el.style.pointerEvents = '';
      setDrag({ from: i, dx: ev.clientX - x0, dy: ev.clientY - y0, over: over !== i ? over : null });
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.style.pointerEvents = 'none';
      const over = slotAt(ev.clientX, ev.clientY);
      el.style.pointerEvents = '';
      setDrag(null);
      if (over !== null && over !== i && !state.fixed[over]) {
        onSwap(i, over);
        sound.clink();
        haptic.tick();
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  const clues = [...puzzle.clues, ...state.extraClues];
  return (
    <div className="bottles-scene">
      {puzzle.spec.information === 'full' && (
        <div className="label-order" aria-label="The order, on a label">
          <small>Label on the shelf</small>
          <div>{puzzle.secret.map((id, k) => <BottleIcon key={k} id={id} size={28} symbols={symbols} />)}</div>
        </div>
      )}
      <div className={`shelf-row${rattle ? ' rattle' : ''}${solved ? ' open' : ''}`} ref={shelf}>
        {state.order.map((id, i) => {
          const dragging = drag?.from === i;
          return (
            <div key={i} data-slot={i} className={`bottle-slot${drag?.over === i ? ' over' : ''}`}>
              <button
                className={`bottle${dragging ? ' dragging' : ''}${lit[i] ? ' lit' : ''}${state.fixed[i] ? ' fixed' : ''}`}
                style={dragging ? { transform: `translate(${drag.dx}px, ${drag.dy - 14}px) scale(1.08)` } : undefined}
                onPointerDown={down(i)}
                aria-label={`${BOTTLES[id].name} bottle, position ${i + 1}`}
              >
                <span className="cork" />
                <BottleIcon id={id} size={Math.min(86, 330 / state.order.length)} symbols={symbols} />
              </button>
            </div>
          );
        })}
        <button className="lever" onClick={onTry} aria-label="Pull the lever to try">
          <span className="lever-arm" />
          <span className="lever-knob" />
        </button>
      </div>
      <div className="shelf-board" />
      {clues.length > 0 && (
        <div className="clues">
          {clues.map((c, i) => (
            <ClueCard key={i} big={<div className="big"><ClueLine c={c} symbols={symbols} /></div>}>
              <ClueLine c={c} symbols={symbols} />
            </ClueCard>
          ))}
        </div>
      )}
    </div>
  );
}
