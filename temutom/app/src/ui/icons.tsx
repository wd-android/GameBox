import type { JSX } from 'react';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  const paths: Record<string, JSX.Element> = {
    stare: <><path {...P} d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><ellipse cx="12" cy="12" rx="1.6" ry="3.4" fill="currentColor" /></>,
    smack: <><path {...P} d="M7 14c-2-2-2-5 0-7l3-3c1-1 2.5-1 3.5 0l5 5c1 1 1 2.5 0 3.5l-3 3c-2 2-5 2-7 0z" /><path {...P} d="M3 3l3 3M2 9h3M9 2v3" /></>,
    sitOn: <><path {...P} d="M4 18h16M6 18v-4h12v4M8 14V9a4 4 0 0 1 8 0v5" /><path {...P} d="M9 6l-1-3 3 2M15 6l1-3-3 2" /></>,
    knockOff: <><path {...P} d="M3 8h12" /><path {...P} d="M16 10l3 9" /><rect x="15" y="4" width="4" height="4" rx="1" fill="currentColor" transform="rotate(25 17 6)" /><path {...P} d="M8 8v-3h4v3" /></>,
    scream: <><path {...P} d="M8 9c0-3 2-5 4-5s4 2 4 5v2c0 3-2 5-4 5s-4-2-4-5z" /><ellipse cx="12" cy="12" rx="2" ry="2.6" fill="currentColor" /><path {...P} d="M3 7l2 1M2 12h3M3 17l2-1M21 7l-2 1M22 12h-3M21 17l-2-1" /></>,
    pause: <><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></>,
    brain: <><path {...P} d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1" /></>,
    flame: <path {...P} d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4 1-6 1-9z" />,
    heart: <path {...P} d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
    eyeClosed: <path {...P} d="M3 12c3 3 6 4 9 4s6-1 9-4M6 15l-1 2M12 16v2M18 15l1 2" />,
    hand: <path {...P} d="M8 13V6a1.5 1.5 0 0 1 3 0v5V4.5a1.5 1.5 0 0 1 3 0V11V6a1.5 1.5 0 0 1 3 0v8c0 4-3 7-6 7s-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 13z" />,
    home: <path {...P} d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
    back: <path {...P} d="M15 5l-7 7 7 7" />,
    star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor" />,
    crown: <path d="M3 18h18l-1.5-10-4.5 4-3-6-3 6-4.5-4z" fill="currentColor" />,
    scheme: <><path {...P} d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" fill="currentColor" /></>,
    share: <><path {...P} d="M12 3v12M7 8l5-5 5 5" /><path {...P} d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>,
    cog: <><circle {...P} cx="12" cy="12" r="3" /><path {...P} d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
    cat: <><path d="M5 20c0-6 3-9 7-9s7 3 7 9z" fill="currentColor" /><circle cx="14.5" cy="8.5" r="3.5" fill="currentColor" /><path d="M11.5 6l.5-4 2 2.5zM17.5 6l-.5-4-2 2.5z" fill="currentColor" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[name] ?? null}</svg>;
}

export function Stars({ n, of = 3 }: { n: number; of?: number }) {
  return (
    <span className="stars" aria-label={`${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => <span key={i} className={i < n ? '' : 'off'}>★</span>)}
    </span>
  );
}

/** Marker for the attention band: a little cat head, so it reads by shape as well as colour */
export function MarkerHead({ cross }: { cross: boolean }) {
  return (
    <svg width="28" height="30" viewBox="0 0 28 30" aria-hidden="true">
      <path d="M14 30 L8 20 L20 20 Z" fill="#fff" />
      <path d="M4 6 L7 0 L10 5 M24 6 L21 0 L18 5" fill="#ff8a1f" stroke="#2a1a12" strokeWidth="1.4" />
      <ellipse cx="14" cy="12" rx="10" ry="9" fill="#ff8a1f" stroke="#2a1a12" strokeWidth="1.6" />
      <path d={cross ? 'M8 10 l3 3 M11 10 l-3 3 M17 10 l3 3 M20 10 l-3 3' : 'M7 11 h5 M16 11 h5'} stroke="#2a1a12" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 16 q2 -1 4 0" stroke="#2a1a12" strokeWidth="1.3" fill="none" />
    </svg>
  );
}
