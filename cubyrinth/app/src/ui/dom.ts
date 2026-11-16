type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined | null>;
type Child = Node | string | null | undefined | false;

/** Tiny element builder. `on*` attributes become event listeners. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'style') el.setAttribute('style', String(v));
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export function svg(path: string): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}

export const ICONS = {
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  level: svg('<path d="M3 12h18"/><path d="M7 8l-4 4 4 4M17 8l4 4-4 4"/>'),
};

export function iconButton(icon: string, label: string, onClick: () => void, extra = ''): HTMLButtonElement {
  const b = h('button', { class: `icon-btn ${extra}`, 'aria-label': label, html: icon });
  b.addEventListener('click', onClick);
  return b;
}

export function toggle(on: boolean, onChange: (v: boolean) => void, locked = false): HTMLButtonElement {
  const b = h('button', { class: `toggle${on ? ' on' : ''}${locked ? ' locked' : ''}`, role: 'switch', 'aria-checked': String(on) });
  b.addEventListener('click', () => {
    if (locked) return;
    const v = !b.classList.contains('on');
    b.classList.toggle('on', v);
    b.setAttribute('aria-checked', String(v));
    onChange(v);
  });
  return b;
}

export function segmented<T extends string>(options: [T, string][], value: T, onChange: (v: T) => void): HTMLElement {
  const wrap = h('div', { class: 'segmented', role: 'radiogroup' });
  for (const [v, label] of options) {
    const b = h('button', { class: v === value ? 'on' : '', role: 'radio' }, label);
    b.addEventListener('click', () => {
      wrap.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onChange(v);
    });
    wrap.append(b);
  }
  return wrap;
}

export function toast(text: string, ms = 1800): void {
  const t = h('div', { class: 'toast' }, text);
  document.getElementById('ui')!.append(t);
  window.setTimeout(() => t.remove(), ms);
}

export function corkIcon(): string {
  return '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 6h12l-1.6 10.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8z" fill="#c8955a"/><ellipse cx="10" cy="6" rx="6" ry="2.2" fill="#e0b27a"/><circle cx="8" cy="11" r=".9" fill="#8a5a2b"/><circle cx="12" cy="13" r=".9" fill="#8a5a2b"/></svg>';
}
