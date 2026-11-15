import { useRef } from 'react';
import type { RingsPuzzle, RingsState } from '../../locks/rings/rings';
import { sound } from '../../audio/sound';
import { haptic } from '../../audio/haptics';
import { ClueCard } from './common';

interface Props {
  puzzle: RingsPuzzle;
  state: RingsState;
  solved: boolean;
  /** "Which": lit markers on aligned rings. "How many": a counter only. */
  which: boolean;
  symbols: boolean;
  hintMove: { ring: number; dir: 1 | -1 } | null;
  onTurn(ring: number, dir: 1 | -1): void;
}

const R = 150; // outer radius in SVG units
const CORE = 34; // radius of the fixed centre boss

/** Ring i spans [inner, outer] radii; ring 0 is innermost. */
function radii(n: number, i: number): [number, number] {
  const w = (R - CORE) / n;
  return [CORE + i * w, CORE + (i + 1) * w];
}

function annulus(r0: number, r1: number): string {
  return `M0 ${-r1}A${r1} ${r1} 0 1 1 0 ${r1}A${r1} ${r1} 0 1 1 0 ${-r1}ZM0 ${-r0}A${r0} ${r0} 0 1 0 0 ${r0}A${r0} ${r0} 0 1 0 0 ${-r0}Z`;
}

/** Three pictures, each with strong shapes crossing every ring, so misalignment is obvious without colour. */
function Picture({ kind }: { kind: number }) {
  if (kind === 0) {
    // Compass rose
    const pts: string[] = [];
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8 - Math.PI / 2;
      const r = k % 4 === 0 ? R : k % 2 === 0 ? R * 0.62 : R * 0.3;
      pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
    }
    return (
      <g>
        <circle r={R} fill="#2a5f7a" />
        <circle r={R * 0.82} fill="none" stroke="#9fd3e6" strokeWidth="3" strokeDasharray="6 8" />
        <polygon points={pts.join(' ')} fill="#f3d07a" stroke="#5a3a0a" strokeWidth="3" />
        <polygon points={`0,${-R} 14,0 0,0`} fill="#c2412d" />
        <polygon points={`0,${R} -14,0 0,0`} fill="#7a4a12" />
      </g>
    );
  }
  if (kind === 1) {
    // Sun and waves
    const rays = Array.from({ length: 12 }, (_, k) => {
      const a = (k * Math.PI) / 6;
      return <path key={k} d={`M0 0L${Math.cos(a - 0.12) * R} ${Math.sin(a - 0.12) * R}L${Math.cos(a + 0.12) * R} ${Math.sin(a + 0.12) * R}Z`} fill={k % 2 ? '#f6921e' : '#ffd25a'} />;
    });
    return (
      <g>
        <circle r={R} fill="#5b33a0" />
        {rays}
        <path d={`M${-R} 30Q-75 0 0 30T${R} 30V${R}H${-R}Z`} fill="#1f8a9c" opacity=".9" />
        <path d={`M-40 ${-R}L40 ${-R}L8 0L-8 0Z`} fill="#ffffff" opacity=".85" />
      </g>
    );
  }
  // Flower
  const petals = Array.from({ length: 6 }, (_, k) => (
    <ellipse key={k} cx="0" cy={-R * 0.55} rx={R * 0.2} ry={R * 0.45} fill={k % 2 ? '#e25b8f' : '#f6a6c6'} stroke="#5a1036" strokeWidth="3" transform={`rotate(${k * 60})`} />
  ));
  return (
    <g>
      <circle r={R} fill="#20603c" />
      <path d={`M-10 ${R}L10 ${R}L4 0L-4 0Z`} fill="#86c46a" />
      {petals}
      <path d={`M0 ${-R}L12 ${-R * 0.75}L0 ${-R * 0.5}L-12 ${-R * 0.75}Z`} fill="#fff" />
    </g>
  );
}

/** Concentric rings (§6.3): drag a ring round the centre to turn it, one notch at a time. */
export function RingsView({ puzzle, state, solved, which, symbols, hintMove, onTurn }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const n = puzzle.spec.parts;
  const stepDeg = 360 / puzzle.steps;
  const aligned = state.offsets.map((o) => o === 0);
  const count = aligned.filter(Boolean).length;
  const showGears = puzzle.spec.information === 'clued';
  // Displayed angles accumulate, so a ring going from the last notch to 0 turns forward, not all the way back.
  const shown = useRef<number[]>([]);
  const angles = state.offsets.map((o, i) => {
    const target = o * stepDeg;
    const prev = shown.current[i];
    if (prev === undefined) return target;
    let d = (((target - prev) % 360) + 360) % 360;
    if (d > 180) d -= 360;
    return prev + d;
  });
  shown.current = angles;

  const down = (e: React.PointerEvent) => {
    if (solved || !svg.current) return;
    const box = svg.current.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const scale = box.width / (2 * R + 20);
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy) / scale;
    let ring = -1;
    for (let i = 0; i < n; i++) {
      const [a, b] = radii(n, i);
      if (dist >= a - 4 && dist <= b + 6) ring = i;
    }
    if (ring < 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    let last = Math.atan2(e.clientY - cy, e.clientX - cx);
    let acc = 0;
    const target = e.currentTarget as Element;
    const move = (ev: PointerEvent) => {
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      let d = a - last;
      if (d > Math.PI) d -= 2 * Math.PI;
      if (d < -Math.PI) d += 2 * Math.PI;
      last = a;
      acc += (d * 180) / Math.PI;
      while (Math.abs(acc) >= stepDeg * 0.6) {
        const dir = acc > 0 ? 1 : -1;
        acc -= dir * stepDeg;
        onTurn(ring, dir);
        sound.tick();
        haptic.tick();
      }
    };
    const up = () => {
      target.removeEventListener('pointermove', move as EventListener);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move as EventListener);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  return (
    <div className="rings-scene">
      <div className={`rings-wrap${solved ? ' open' : ''}`}>
        <svg ref={svg} viewBox={`${-R - 10} ${-R - 10} ${2 * R + 20} ${2 * R + 20}`} className="rings-svg" onPointerDown={down} role="img" aria-label={`${count} of ${n} rings aligned`}>
          <defs>
            {Array.from({ length: n }, (_, i) => (
              <clipPath id={`ring-clip-${i}`} key={i}>
                <path d={annulus(...radii(n, i))} fillRule="evenodd" />
              </clipPath>
            ))}
          </defs>
          <circle r={R + 8} fill="#3a2410" stroke="#c99a4a" strokeWidth="4" />
          {Array.from({ length: puzzle.steps }, (_, k) => (
            <line key={k} x1="0" y1={-R - 8} x2="0" y2={-R - 2} stroke="#f3d07a" strokeWidth="2" transform={`rotate(${k * stepDeg})`} />
          ))}
          {Array.from({ length: n }, (_, i) => {
            const [r0, r1] = radii(n, i);
            const rot = angles[i];
            const hinted = hintMove?.ring === i;
            return (
              <g key={i} className="ring" style={{ transform: `rotate(${rot}deg)` }}>
                <g clipPath={`url(#ring-clip-${i})`}>
                  <Picture kind={puzzle.picture} />
                </g>
                <circle r={r1} fill="none" stroke="#1b043b" strokeWidth="3" />
                {hinted && <circle r={(r0 + r1) / 2} fill="none" stroke="#06ffff" strokeWidth={r1 - r0 - 4} opacity=".28" />}
                {/* The ring's own marker: at the top when aligned */}
                <circle cx="0" cy={-(r0 + r1) / 2} r="5" fill={which && aligned[i] ? '#4dff88' : '#1b043b'} stroke="#fff" strokeWidth="1.5" />
                {symbols && which && aligned[i] && (
                  <text x="0" y={-(r0 + r1) / 2 + 3.5} textAnchor="middle" fontSize="8" fill="#1b043b">✓</text>
                )}
              </g>
            );
          })}
          {/* Fixed ring numbers along the bottom, 1 = innermost */}
          {Array.from({ length: n }, (_, i) => {
            const [r0, r1] = radii(n, i);
            return (
              <g key={`n${i}`} transform={`translate(0 ${(r0 + r1) / 2})`} pointerEvents="none">
                <circle r="9" fill="#1b043b" opacity=".8" />
                <text y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
                  {i + 1}
                </text>
              </g>
            );
          })}
          <circle r={CORE} fill="#c99a4a" stroke="#5a3a0a" strokeWidth="3" />
          <circle r={CORE * 0.45} fill="#5a3a0a" />
          {showGears &&
            puzzle.linkages.map((l, k) => {
              const [, r1] = radii(n, Math.min(l.driver, l.follower));
              const a = ((k * 2 + 1) * Math.PI) / (puzzle.linkages.length * 2) + Math.PI / 2;
              return (
                <g key={k} transform={`translate(${Math.cos(a) * r1} ${Math.sin(a) * r1})`} className="gear">
                  <circle r="11" fill="#c99a4a" stroke="#5a3a0a" strokeWidth="2" strokeDasharray="4 2.5" />
                  <text y="4" textAnchor="middle" fontSize="11" fill="#1b043b" fontWeight="700">
                    {l.sign > 0 ? '⟳' : '⇄'}
                  </text>
                </g>
              );
            })}
          {hintMove && (
            <text x="0" y={-R - 14} textAnchor="middle" fontSize="20" fill="#06ffff">
              {hintMove.dir > 0 ? '↻' : '↺'}
            </text>
          )}
        </svg>
      </div>
      <div className="rings-counter" aria-live="polite">
        {count} of {n} rings aligned
      </div>
      {showGears && (
        <div className="clues">
          {puzzle.linkages.map((l, k) => (
            <ClueCard key={k}>
              <div className="clue-row">
                <span className="gear-chip">{l.sign > 0 ? '⟳' : '⇄'}</span>
                <span>
                  Turning ring {l.driver + 1} also turns ring {l.follower + 1} {l.sign > 0 ? 'the same way' : 'the opposite way'}.
                </span>
              </div>
            </ClueCard>
          ))}
        </div>
      )}
      {puzzle.spec.information === 'feedback' && <p className="note">Some rings are linked by hidden gears. Turn and watch.</p>}
    </div>
  );
}
