import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import type { ShiftDef, ShiftState } from './sim/types';
import { freshSave, loadSave, writeSave, type SaveData, type Settings } from './state/save';
import { SHIFTS, shiftById, shiftIndex } from './content/shifts';
import { applyShiftResult, nextShift, type ShiftResult } from './game/progress';
import { dailyShift, dateKey } from './game/daily';
import { ShiftScreen } from './ui/ShiftScreen';
import {
  Archive, Cabinet, DailyIntro, DayReview, Home, House, Ranks, Result, SettingsScreen, StaffFiles, Weeks,
} from './ui/screens';
import { sound } from './audio/sound';
import { haptics } from './audio/haptics';

type Screen =
  | { id: 'loading' }
  | { id: 'home' } | { id: 'weeks' } | { id: 'house' } | { id: 'staff' } | { id: 'cabinet' } | { id: 'archive' } | { id: 'ranks' }
  | { id: 'settings'; back: Screen }
  | { id: 'daily' }
  | { id: 'shift'; def: ShiftDef; key: number }
  | { id: 'result'; r: ShiftResult; def: ShiftDef }
  | { id: 'day'; r: ShiftResult; def: ShiftDef };

export function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [screen, setScreen] = useState<Screen>({ id: 'loading' });
  const [bg, setBg] = useState(false);

  useEffect(() => {
    void loadSave().then((s) => {
      setSave(s);
      // First launch opens straight on the kitchen at 4:50am. Home appears after three shifts.
      const dev = import.meta.env.DEV ? new URLSearchParams(location.search).get('shift') : null;
      if (dev) { s.played = Math.max(s.played, 3); setScreen({ id: 'shift', def: dev === 'daily' ? dailyShift(dateKey(new Date())) : shiftById(dev) ?? SHIFTS[0], key: Date.now() }); return; }
      if (s.played < 3) setScreen({ id: 'shift', def: nextShift(s), key: Date.now() });
      else setScreen({ id: 'home' });
    });
  }, []);

  // Apply audio and haptic settings
  useEffect(() => {
    if (!save) return;
    sound.setSfx(save.settings.sfx);
    sound.setMusic(save.settings.music);
    haptics.set(save.settings.vibration);
  }, [save]);

  // Pause when the app goes to the background
  useEffect(() => {
    const vis = () => setBg(document.hidden);
    document.addEventListener('visibilitychange', vis);
    let remove: (() => void) | undefined;
    void CapApp.addListener('appStateChange', ({ isActive }) => setBg(!isActive)).then((h) => { remove = () => void h.remove(); }).catch(() => {});
    return () => { document.removeEventListener('visibilitychange', vis); remove?.(); };
  }, []);

  const persist = useCallback((s: SaveData) => {
    const copy = structuredClone(s);
    setSave(copy);
    void writeSave(copy);
  }, []);

  const reduceMotion = useMemo(() => {
    if (!save) return false;
    if (save.settings.reduceMotion !== null) return save.settings.reduceMotion;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, [save]);

  if (!save || screen.id === 'loading') return <div className="screen" />;

  const playShift = (id: string) => { const d = shiftById(id); if (d) { sound.ensure(); setScreen({ id: 'shift', def: d, key: Date.now() }); } };
  const playDaily = () => { sound.ensure(); setScreen({ id: 'shift', def: dailyShift(dateKey(new Date())), key: Date.now() }); };
  const home = () => { sound.musicStop(); setScreen({ id: 'home' }); };

  const finish = (s: ShiftState) => {
    const next = structuredClone(save);
    const r = applyShiftResult(next, s);
    persist(next);
    sound.musicStop();
    setScreen({ id: 'result', r, def: s.def });
  };

  const afterResult = (r: ShiftResult, def: ShiftDef) => {
    if (r.dayCard) { setScreen({ id: 'day', r, def }); return; }
    goNext(def);
  };
  const goNext = (def: ShiftDef) => {
    if (def.daily) { home(); return; }
    if (save.played < 3) { const i = shiftIndex(def.id); playShift(SHIFTS[Math.min(SHIFTS.length - 1, i + 1)].id); return; }
    const i = shiftIndex(def.id);
    const n = SHIFTS[i + 1];
    if (n) playShift(n.id); else home();
  };

  const setSettings = (st: Settings) => persist({ ...save, settings: st });
  const cls = `${save.settings.largerCaptions ? 'large-captions' : ''} ${reduceMotion ? 'reduce-motion' : ''}`;

  return (
    <div className={cls} style={{ height: '100%' }}>
      {screen.id === 'home' && <Home save={save} go={(id) => setScreen(id === 'settings' ? { id: 'settings', back: { id: 'home' } } : ({ id } as Screen))} playShift={playShift} playDaily={() => setScreen({ id: 'daily' })} />}
      {screen.id === 'weeks' && <Weeks save={save} onBack={home} playShift={playShift} />}
      {screen.id === 'house' && <House save={save} onBack={home} />}
      {screen.id === 'staff' && <StaffFiles save={save} onBack={home} />}
      {screen.id === 'cabinet' && <Cabinet save={save} onBack={home} />}
      {screen.id === 'archive' && <Archive save={save} onBack={home} />}
      {screen.id === 'ranks' && <Ranks save={save} onBack={home} />}
      {screen.id === 'daily' && <DailyIntro save={save} onPlay={playDaily} onBack={home} />}
      {screen.id === 'settings' && (
        <SettingsScreen save={save} onChange={setSettings} onBack={() => setScreen(screen.back)} onReset={() => { const f = freshSave(); f.settings = save.settings; persist(f); setScreen({ id: 'shift', def: SHIFTS[0], key: Date.now() }); }} />
      )}
      {screen.id === 'shift' && (
        <ShiftScreen
          key={screen.key}
          def={screen.def}
          save={save}
          reduceMotion={reduceMotion}
          onFinish={finish}
          onQuit={() => (save.played >= 3 ? home() : playShift(screen.def.id))}
          onSettings={() => setScreen({ id: 'settings', back: { id: 'home' } })}
          pausedExternally={bg}
        />
      )}
      {screen.id === 'result' && (
        <Result
          r={screen.r}
          save={save}
          nextLabel={screen.def.daily ? 'Done' : 'Next shift'}
          onNext={() => afterResult(screen.r, screen.def)}
          onRetry={() => setScreen({ id: 'shift', def: screen.def, key: Date.now() })}
          onHome={home}
        />
      )}
      {screen.id === 'day' && screen.r.dayCard && <DayReview card={screen.r.dayCard} onDone={() => goNext(screen.def)} />}
    </div>
  );
}
