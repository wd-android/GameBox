import { useCallback, useEffect, useMemo, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import type { Mark, MomentDef, MomentState } from './sim/types';
import { freshSave, loadSave, writeSave, type SaveData, type Settings } from './state/save';
import { MOMENTS, momentById, momentIndex } from './content/moments';
import { applyResult, nextMoment, standing, type MomentResult } from './game/progress';
import { dateKey, todaysMood } from './game/daily';
import { MomentScreen } from './ui/screens/MomentScreen';
import { Archive, Cabinet, DayReview, FieldNotes, Home, MoodIntro, Result, SettingsScreen, Weeks } from './ui/screens/screens';
import { sound } from './audio/sound';
import { haptics } from './audio/haptics';
import type { MomentOptions } from './sim/moment';
import { STANDING } from './game/scoring';

type Screen =
  | { id: 'loading' } | { id: 'home' } | { id: 'weeks' } | { id: 'notes' } | { id: 'archive' } | { id: 'cabinet' } | { id: 'mood' }
  | { id: 'settings'; back: Screen }
  | { id: 'moment'; def: MomentDef; key: number }
  | { id: 'result'; r: MomentResult; def: MomentDef; marks: Mark[] }
  | { id: 'day'; r: MomentResult; def: MomentDef };

export function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [screen, setScreen] = useState<Screen>({ id: 'loading' });
  const [bg, setBg] = useState(false);

  useEffect(() => {
    void loadSave().then((s) => {
      setSave(s);
      const dev = import.meta.env.DEV ? new URLSearchParams(location.search).get('m') : null;
      if (dev) { s.played = Math.max(3, s.played); setScreen({ id: 'moment', def: dev === 'mood' ? todaysMood(dateKey(new Date())) : momentById(dev) ?? MOMENTS[0], key: Date.now() }); return; }
      // First launch opens straight on the dark kitchen at 4:50am, him screaming. Home after three moments.
      setScreen(s.played < 3 ? { id: 'moment', def: nextMoment(s), key: Date.now() } : { id: 'home' });
    });
  }, []);

  useEffect(() => {
    if (!save) return;
    sound.setSfx(save.settings.sfx); sound.setMusic(save.settings.music); haptics.set(save.settings.vibration);
  }, [save]);

  useEffect(() => {
    const vis = () => setBg(document.hidden);
    document.addEventListener('visibilitychange', vis);
    let remove: (() => void) | undefined;
    void CapApp.addListener('appStateChange', ({ isActive }) => setBg(!isActive)).then((h) => { remove = () => void h.remove(); }).catch(() => {});
    return () => { document.removeEventListener('visibilitychange', vis); remove?.(); };
  }, []);

  const persist = useCallback((s: SaveData) => { const c = structuredClone(s); setSave(c); void writeSave(c); }, []);
  const device = (q: string) => window.matchMedia?.(q).matches ?? false;
  const reduceMotion = useMemo(() => save?.settings.reduceMotion ?? device('(prefers-reduced-motion: reduce)'), [save]);
  // "Reduce flashing" follows the device's own accessibility setting where available (§9.3)
  const reduceFlashing = useMemo(() => save?.settings.reduceFlashing ?? device('(prefers-reduced-motion: reduce)'), [save]);

  if (!save || screen.id === 'loading') return <div className="screen" />;

  const options = (def: MomentDef): MomentOptions => {
    const st = def.daily ? { rank: 0, minWarning: STANDING[0].minWarning, bandBonus: 0 } : standing(save);
    return {
      standing: { rank: st.rank, minWarning: st.minWarning, bandBonus: st.bandBonus },
      settings: { longerWarnings: save.settings.longerWarnings, reduceFlashing: !!reduceFlashing, leftHanded: save.settings.leftHanded },
    };
  };
  const play = (id: string) => { const d = momentById(id); if (d) { sound.ensure(); setScreen({ id: 'moment', def: d, key: Date.now() }); } };
  const playMood = () => { sound.ensure(); setScreen({ id: 'moment', def: todaysMood(dateKey(new Date())), key: Date.now() }); };
  const home = () => { sound.musicStop(); setScreen({ id: 'home' }); };

  const finish = (s: MomentState) => {
    const next = structuredClone(save);
    const r = applyResult(next, s);
    persist(next);
    sound.musicStop();
    setScreen({ id: 'result', r, def: s.def, marks: s.marks.map((m) => ({ ...m })) });
  };
  const goNext = (def: MomentDef) => {
    if (def.daily) return home();
    const n = MOMENTS[momentIndex(def.id) + 1];
    if (n) play(n.id); else home();
  };
  const cls = `${save.settings.largerCaptions ? 'large-captions' : ''} ${reduceMotion ? 'reduce-motion' : ''}`;

  return (
    <div className={cls} style={{ height: '100%' }}>
      {screen.id === 'home' && <Home save={save} go={(id) => setScreen(id === 'settings' ? { id: 'settings', back: { id: 'home' } } : ({ id } as Screen))} playNext={() => play(nextMoment(save).id)} playMood={() => setScreen({ id: 'mood' })} />}
      {screen.id === 'weeks' && <Weeks save={save} onBack={home} play={play} />}
      {screen.id === 'notes' && <FieldNotes save={save} onBack={home} />}
      {screen.id === 'archive' && <Archive save={save} onBack={home} />}
      {screen.id === 'cabinet' && <Cabinet save={save} onBack={home} />}
      {screen.id === 'mood' && <MoodIntro save={save} onPlay={playMood} onBack={home} />}
      {screen.id === 'settings' && (
        <SettingsScreen save={save} onChange={(st: Settings) => persist({ ...save, settings: st })} onBack={() => setScreen(screen.back)}
          onReset={() => { const f = freshSave(); f.settings = save.settings; persist(f); setScreen({ id: 'moment', def: MOMENTS[0], key: Date.now() }); }} />
      )}
      {screen.id === 'moment' && (
        <MomentScreen key={screen.key} def={screen.def} options={options(screen.def)} reduceMotion={reduceMotion} moodHints={save.settings.moodHints}
          onFinish={finish} onQuit={() => (save.played >= 3 ? home() : play(screen.def.id))} onSettings={() => setScreen({ id: 'settings', back: { id: 'home' } })} pausedExternally={bg} />
      )}
      {screen.id === 'result' && (
        <Result r={screen.r} save={save} marks={screen.marks} nextLabel={screen.def.daily ? 'Done' : 'Next moment'}
          onNext={() => (screen.r.dayCard ? setScreen({ id: 'day', r: screen.r, def: screen.def }) : goNext(screen.def))}
          onRetry={() => setScreen({ id: 'moment', def: screen.def, key: Date.now() })} onHome={home} />
      )}
      {screen.id === 'day' && screen.r.dayCard && <DayReview card={screen.r.dayCard} onDone={() => goNext(screen.def)} />}
    </div>
  );
}
