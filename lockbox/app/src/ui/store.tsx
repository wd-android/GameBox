import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { writeSave, type SaveData } from '../state/save';
import { sound } from '../audio/sound';
import { haptic } from '../audio/haptics';
import type { ChestSession } from '../game/session';
import type { OpenOutcome } from '../game/progress';

export type Route =
  | { name: 'home' }
  | { name: 'chapters' }
  | { name: 'chapter'; id: number }
  | { name: 'chest'; session: ChestSession }
  | { name: 'lock'; session: ChestSession; index: number }
  | { name: 'opening'; session: ChestSession; outcome: OpenOutcome; extra?: string }
  | { name: 'vault' };

interface Store {
  save: SaveData;
  route: Route;
  go(route: Route): void;
  /** Re-render after mutating the save or a session, and write the save. */
  commit(): void;
  setSave(s: SaveData): void;
  version: number;
}

/** `?debug` exposes the store for automated browser checks. */
export const DEBUG = new URLSearchParams(location.search).has('debug');

const Ctx = createContext<Store | null>(null);

export function applySettings(save: SaveData): void {
  const s = save.settings;
  sound.sfx = s.sfx;
  sound.setMusic(s.music);
  haptic.enabled = s.vibration;
  document.body.classList.toggle('reduce-motion', s.reduceMotion);
  document.body.classList.toggle('large-clues', s.largeClues);
  document.body.classList.toggle('no-symbols', !s.symbols);
}

export function StoreProvider({ initial, start, children }: { initial: SaveData; start: Route; children: ReactNode }) {
  const [save, setSaveState] = useState(initial);
  const [route, setRoute] = useState<Route>(start);
  const [version, setVersion] = useState(0);
  const commit = useCallback(() => {
    void writeSave(save);
    applySettings(save);
    setVersion((v) => v + 1);
  }, [save]);
  const go = useCallback((r: Route) => {
    setRoute(r);
    setVersion((v) => v + 1);
  }, []);
  const setSave = useCallback((s: SaveData) => {
    setSaveState(s);
    void writeSave(s);
    applySettings(s);
  }, []);
  if (DEBUG) (window as unknown as { __lb: unknown }).__lb = { save, route, go, commit };
  const value = useMemo(() => ({ save, route, go, commit, setSave, version }), [save, route, go, commit, setSave, version]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('no store');
  return s;
}
