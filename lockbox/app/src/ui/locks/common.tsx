import { useState, type ReactNode } from 'react';

/** A clue card that can be tapped to enlarge (§12: never smaller than 16 points, enlargeable). */
export function ClueCard({ children, big }: { children: ReactNode; big?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="clue-card" onClick={() => setOpen(true)} aria-label="Enlarge clue">
        {children}
      </button>
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="sheet card clue-big">{big ?? children}</div>
        </div>
      )}
    </>
  );
}

/** Vertical drag helper: calls onStep(+1/−1) for every `px` moved. */
export function useDragSteps(onStep: (d: number) => void, px = 26) {
  return (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    let last = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - last;
      if (Math.abs(dy) >= px) {
        const steps = Math.trunc(dy / px);
        for (let i = 0; i < Math.abs(steps); i++) onStep(steps < 0 ? 1 : -1);
        last += steps * px;
        moved = true;
      }
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (!moved) {
        // A tap: upper half turns up, lower half turns down.
        const r = el.getBoundingClientRect();
        onStep(ev.clientY < r.top + r.height / 2 ? 1 : -1);
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
}
