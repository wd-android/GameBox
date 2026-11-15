import type { ReactNode } from 'react';
import type { Tier } from '../config/tuning';
import type { LockTypeId } from '../locks/types';
import { trinket } from '../chest/trinkets';

const TIER_COLOURS: Record<Tier, { wood: string; band: string; dark: string }> = {
  wooden: { wood: '#9a6233', band: '#6b4120', dark: '#4a2b14' },
  iron: { wood: '#7d5531', band: '#8d93a3', dark: '#3d3f48' },
  silver: { wood: '#6a3f58', band: '#dfe3ee', dark: '#3a2236' },
  gold: { wood: '#5b2c1a', band: '#f2c14e', dark: '#3a160a' },
};

/** A drawn chest for each tier. `open` lifts the lid and lets light spill out. */
export function ChestArt({ tier, open = false, size = 220, glow = false }: { tier: Tier; open?: boolean; size?: number; glow?: boolean }) {
  const c = TIER_COLOURS[tier];
  return (
    <svg viewBox="0 0 220 190" width={size} height={(size * 190) / 220} className={`chest-art${open ? ' open' : ''}`} aria-label={`${tier} chest`} role="img">
      <defs>
        <radialGradient id={`light-${tier}`} cx=".5" cy="1" r=".9">
          <stop offset="0" stopColor="#fff6c8" stopOpacity=".95" />
          <stop offset=".5" stopColor="#ffd166" stopOpacity=".45" />
          <stop offset="1" stopColor="#ffd166" stopOpacity="0" />
        </radialGradient>
      </defs>
      {(open || glow) && <path className="chest-light" d="M30 92 L-10 -20 L230 -20 L190 92 Z" fill={`url(#light-${tier})`} />}
      {/* Body */}
      <rect x="22" y="88" width="176" height="92" rx="8" fill={c.wood} stroke={c.dark} strokeWidth="4" />
      {[0, 1, 2].map((k) => (
        <line key={k} x1="26" x2="194" y1={112 + k * 22} y2={112 + k * 22} stroke={c.dark} strokeWidth="2" opacity=".45" />
      ))}
      <rect x="22" y="88" width="16" height="92" fill={c.band} stroke={c.dark} strokeWidth="3" />
      <rect x="182" y="88" width="16" height="92" fill={c.band} stroke={c.dark} strokeWidth="3" />
      <rect className="chest-inside" x="30" y="72" width="160" height="20" rx="4" fill="#1a0c04" />
      {/* Lid */}
      <g className="chest-lid">
        <path d="M22 90 V60 Q22 22 110 22 Q198 22 198 60 V90 Z" fill={c.wood} stroke={c.dark} strokeWidth="4" />
        <path d="M22 90 V60 Q22 22 38 26 V90Z" fill={c.band} stroke={c.dark} strokeWidth="3" />
        <path d="M198 90 V60 Q198 22 182 26 V90Z" fill={c.band} stroke={c.dark} strokeWidth="3" />
        <rect x="18" y="82" width="184" height="10" rx="3" fill={c.band} stroke={c.dark} strokeWidth="3" />
      </g>
      {/* Hasp */}
      <rect x="96" y="84" width="28" height="34" rx="5" fill={c.band} stroke={c.dark} strokeWidth="3" />
      <circle cx="110" cy="104" r="5" fill={c.dark} />
    </svg>
  );
}

/** A small icon for each lock type. */
export function LockIcon({ type, open = false, size = 56 }: { type: LockTypeId; open?: boolean; size?: number }) {
  const body = (() => {
    switch (type) {
      case 'padlock':
        return (
          <>
            <path d={open ? 'M18 30 V18 a12 12 0 0 1 24 0 V12' : 'M18 30 V18 a12 12 0 0 1 24 0 V30'} fill="none" stroke="#d8dbe6" strokeWidth="6" strokeLinecap="round" />
            <rect x="10" y="28" width="40" height="28" rx="6" fill="#d4a64a" stroke="#5a3a0a" strokeWidth="3" />
            <text x="30" y="48" textAnchor="middle" fontSize="12" fill="#3a2410" fontWeight="700">
              123
            </text>
          </>
        );
      case 'bottles':
        return (
          <>
            <rect x="6" y="52" width="48" height="5" rx="2" fill="#8a5a2b" />
            <path d="M12 22h6v8c4 2 6 6 6 10v12H6V40c0-4 2-8 6-10Z" fill="#e25b5b" stroke="#1b043b" strokeWidth="2" />
            <path d="M27 18h6v10c3 2 5 5 5 9v15H22V37c0-4 2-7 5-9Z" fill="#4da3ff" stroke="#1b043b" strokeWidth="2" />
            <path d="M42 24h6v8c4 2 6 6 6 9v11H36V41c0-3 2-7 6-9Z" fill="#59c46a" stroke="#1b043b" strokeWidth="2" />
          </>
        );
      case 'rings':
        return (
          <>
            <circle cx="30" cy="32" r="24" fill="#2a5f7a" stroke="#c99a4a" strokeWidth="3" />
            <circle cx="30" cy="32" r="16" fill="none" stroke="#1b043b" strokeWidth="2" />
            <circle cx="30" cy="32" r="8" fill="#c99a4a" stroke="#1b043b" strokeWidth="2" />
            <path d="M30 8 L34 24 L30 32 L26 24Z" fill="#f3d07a" transform={open ? undefined : 'rotate(40 30 32)'} />
          </>
        );
      case 'bolts':
        return (
          <>
            <rect x="6" y="8" width="48" height="48" rx="4" fill="#3a2410" stroke="#c99a4a" strokeWidth="3" />
            <rect x={open ? 34 : 10} y="26" width="22" height="10" rx="3" fill="#f2c14e" stroke="#5a3a0a" strokeWidth="2" />
            <rect x="36" y="12" width="10" height="20" rx="3" fill="#b07a45" stroke="#3a2410" strokeWidth="2" opacity={open ? 0.4 : 1} />
            <rect x="12" y="40" width="24" height="10" rx="3" fill="#b07a45" stroke="#3a2410" strokeWidth="2" />
          </>
        );
    }
  })();
  return (
    <svg viewBox="0 0 60 62" width={size} height={size} aria-hidden>
      {body}
    </svg>
  );
}

export function Stars({ n, of = 3, kind = 'gold', size }: { n: number; of?: number; kind?: 'gold' | 'silver'; size?: number }) {
  return (
    <span className={`mini-stars ${kind}`} style={size ? { fontSize: size } : undefined} aria-label={`${n} ${kind} star${n === 1 ? '' : 's'}`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < n ? 'on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange(v: boolean): void; label: string }) {
  return <button className={`toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export function Coins({ n }: { n: number }) {
  return (
    <span className="chip coins" aria-label={`${n} coins`}>
      <span className="coin" aria-hidden />
      {n}
    </span>
  );
}

export function TrinketToken({ id, size = 52, children }: { id: string; size?: number; children?: ReactNode }) {
  const t = trinket(id);
  if (!t) return null;
  return (
    <span className={`trinket${t.rare ? ' rare' : ''}`} style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, #fff8, ${t.tint} 45%, #0006 110%)` }} title={t.name}>
      <span style={{ fontSize: size * 0.5 }}>{t.glyph}</span>
      {children}
    </span>
  );
}

export const TYPE_NAMES: Record<LockTypeId, string> = { padlock: 'Padlock', bottles: 'Bottles', rings: 'Rings', bolts: 'Bolts' };
export const INFO_NAMES = { full: 'Shown', clued: 'Clued', feedback: 'By feel' } as const;
