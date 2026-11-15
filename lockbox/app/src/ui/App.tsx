import { useStore } from './store';
import { Home, Chapters } from './screens/Home';
import { ChapterMap } from './screens/ChapterMap';
import { ChestScreen } from './screens/ChestScreen';
import { LockScreen } from './screens/LockScreen';
import { Opening } from './screens/Opening';
import { Vault } from './screens/Vault';

export function App() {
  const { route } = useStore();
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'chapters':
      return <Chapters />;
    case 'chapter':
      return <ChapterMap key={route.id} id={route.id} />;
    case 'chest':
      return <ChestScreen session={route.session} />;
    case 'lock':
      // Keyed by retry as well, so a fresh Locksmith chest resets the view.
      return <LockScreen key={`${route.session.chest.id}-${route.index}-${route.session.retry}`} session={route.session} index={route.index} />;
    case 'opening':
      return <Opening key={route.session.chest.id} session={route.session} outcome={route.outcome} dailyKey={route.extra} />;
    case 'vault':
      return <Vault />;
  }
}
