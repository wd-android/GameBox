import { clueText, type PadlockPuzzle, type PadlockState } from '../../locks/padlock/padlock';
import { sound } from '../../audio/sound';
import { haptic } from '../../audio/haptics';
import { ClueCard, useDragSteps } from './common';

interface Props {
  puzzle: PadlockPuzzle;
  state: PadlockState;
  solved: boolean;
  onTurn(wheel: number, delta: number): void;
  onTry(): void;
  /** Wheels lit by the last "Which" feedback (cleared when that wheel turns). */
  lit: boolean[];
  rattle: boolean;
}

function Wheel({ value, fixed, lit, onStep }: { value: number; fixed: boolean; lit: boolean; onStep(d: number): void }) {
  const drag = useDragSteps((d) => {
    if (fixed) return;
    onStep(d);
    sound.tick();
    haptic.tick();
  });
  const prev = (value + 9) % 10;
  const next = (value + 1) % 10;
  return (
    <div className={`wheel${fixed ? ' fixed' : ''}${lit ? ' lit' : ''}`} onPointerDown={drag} role="spinbutton" aria-valuenow={value} aria-label={`Wheel showing ${value}`}>
      <span className="wheel-digit dim">{next}</span>
      <span className="wheel-digit">{value}</span>
      <span className="wheel-digit dim">{prev}</span>
      {fixed && <span className="wheel-pin" aria-hidden>📌</span>}
    </div>
  );
}

/** Digit padlock (§6.1): drag a wheel up or down to turn it; tap the shackle to try. */
export function PadlockView({ puzzle, state, solved, onTurn, onTry, lit, rattle }: Props) {
  const clues = [...puzzle.clues, ...state.extraClues];
  return (
    <div className="padlock-scene">
      {puzzle.shown && (
        <div className="scratch" aria-label={`${puzzle.shown}: ${puzzle.secret.join(' ')}`}>
          <small>{puzzle.shown}</small>
          <b>{puzzle.secret.join(' ')}</b>
        </div>
      )}
      <div className={`padlock${solved ? ' open' : ''}${rattle ? ' rattle' : ''}`}>
        <button className="shackle" onClick={onTry} aria-label="Try the code">
          <svg viewBox="0 -14 200 134" aria-hidden>
            <defs>
              <linearGradient id="steel" x1="0" x2="1">
                <stop offset="0" stopColor="#8b8fa0" />
                <stop offset=".5" stopColor="#f1f2f7" />
                <stop offset="1" stopColor="#7c8090" />
              </linearGradient>
            </defs>
            <path d="M40 120 V60 a60 60 0 0 1 120 0 V120" fill="none" stroke="url(#steel)" strokeWidth="22" strokeLinecap="round" />
          </svg>
        </button>
        <div className="padlock-body">
          <div className="wheels">
            {state.wheels.map((v, i) => (
              <Wheel key={i} value={v} fixed={state.fixed[i]} lit={lit[i]} onStep={(d) => onTurn(i, d)} />
            ))}
          </div>
          <div className="keyhole" aria-hidden />
        </div>
      </div>
      {clues.length > 0 && (
        <div className="clues">
          {clues.map((c, i) => (
            <ClueCard
              key={i}
              big={
                <div className="clue-row big">
                  <span className="code-boxes">{c.guess.map((d, k) => <i key={k}>{d}</i>)}</span>
                  <span>{clueText(c)}</span>
                </div>
              }
            >
              <div className="clue-row">
                <span className="code-boxes">{c.guess.map((d, k) => <i key={k}>{d}</i>)}</span>
                <span>{clueText(c)}</span>
              </div>
            </ClueCard>
          ))}
        </div>
      )}
    </div>
  );
}
