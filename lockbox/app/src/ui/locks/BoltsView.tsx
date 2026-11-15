import { useRef, useState } from 'react';
import { slideRange, type BoltsMove, type BoltsPuzzle, type BoltsState } from '../../locks/bolts/bolts';
import { sound } from '../../audio/sound';
import { haptic } from '../../audio/haptics';

interface Props {
  puzzle: BoltsPuzzle;
  state: BoltsState;
  solved: boolean;
  hintMove: BoltsMove | null;
  onSlide(bolt: number, to: number): void;
}

/** Sliding bolts (§6.4): drag a bolt along its own length; slide the brass latch out through the right. */
export function BoltsView({ puzzle, state, solved, hintMove, onSlide }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ bolt: number; at: number } | null>(null);
  const n = puzzle.size;

  const down = (i: number) => (e: React.PointerEvent) => {
    if (solved || !frame.current) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const cell = frame.current.getBoundingClientRect().width / n;
    const b = puzzle.bolts[i];
    const [lo, hi] = slideRange(puzzle, state.pos, i);
    const start = state.pos[i];
    const p0 = b.horizontal ? e.clientX : e.clientY;
    let at = start;
    setDrag({ bolt: i, at });
    const move = (ev: PointerEvent) => {
      const d = ((b.horizontal ? ev.clientX : ev.clientY) - p0) / cell;
      const next = Math.max(lo, Math.min(hi, start + d));
      if (Math.round(next) !== Math.round(at)) sound.slide();
      at = next;
      setDrag({ bolt: i, at });
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      const to = Math.round(at);
      setDrag(null);
      if (to !== start) {
        sound.knock();
        haptic.tick();
        onSlide(i, to);
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const pct = (v: number) => `${(v / n) * 100}%`;
  return (
    <div className="bolts-scene">
      <div className={`bolts-frame${solved ? ' open' : ''}`} ref={frame} style={{ ['--n' as string]: n }}>
        <div className="bolts-grid" />
        <div className="bolts-exit" style={{ top: pct(puzzle.exitRow), height: pct(1) }} aria-hidden>
          <span>▶</span>
        </div>
        {puzzle.bolts.map((b, i) => {
          const at = drag?.bolt === i ? drag.at : state.pos[i];
          const out = solved && i === 0 ? 2.4 : 0;
          const style = b.horizontal
            ? { left: pct(at + out), top: pct(b.line), width: pct(b.len), height: pct(1) }
            : { left: pct(b.line), top: pct(at), width: pct(1), height: pct(b.len) };
          const hinted = hintMove?.bolt === i;
          return (
            <button
              key={i}
              className={`bolt ${b.horizontal ? 'h' : 'v'}${i === 0 ? ' latch' : ''}${drag?.bolt === i ? ' dragging' : ''}${hinted ? ' hinted' : ''}`}
              style={style}
              onPointerDown={down(i)}
              aria-label={i === 0 ? 'Brass latch' : `Bolt ${i + 1}, ${b.horizontal ? 'slides left and right' : 'slides up and down'}`}
            >
              <span className="bolt-grip">{b.horizontal ? '⋮' : '⋯'}</span>
              {hinted && hintMove && (
                <span className="bolt-arrow">
                  {b.horizontal ? (hintMove.to > state.pos[i] ? '→' : '←') : hintMove.to > state.pos[i] ? '↓' : '↑'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
