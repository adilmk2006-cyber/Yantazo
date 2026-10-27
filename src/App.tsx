import { Suspense, lazy, useEffect } from 'react';
import { GameProvider, useGame } from './ui/GameContext';
import { href, useRoute } from './ui/router';
import { ScreenBoundary } from './ui/components/ScreenBoundary';
import { Icon } from './ui/components/Icon';
import { Home } from './ui/screens/Home';
import { EndlessSetup } from './ui/screens/EndlessSetup';
import { EndlessSession } from './ui/screens/EndlessSession';
import { DailyScreen } from './ui/screens/Daily';
import { Dashboard } from './ui/screens/Dashboard';
import { HistoryScreen } from './ui/screens/History';
import { ReplayScreen } from './ui/screens/Replay';
import { SettingsScreen } from './ui/screens/Settings';

const MysteryList = lazy(() => import('./ui/mysteries/MysteryList'));
const CaseScreen = lazy(() => import('./ui/mysteries/CaseScreen'));

const NAV = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/endless', label: 'Endless', icon: 'infinity' },
  { path: '/mysteries', label: 'Mysteries', icon: 'mystery' },
  { path: '/daily', label: 'Daily', icon: 'calendar' },
  { path: '/dashboard', label: 'Progress', icon: 'chart' },
  { path: '/history', label: 'History', icon: 'history' },
  { path: '/settings', label: 'Settings', icon: 'gear' },
];

function Shell() {
  const route = useRoute();
  const game = useGame();
  const { settings } = game;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.textSize = settings.textSize;
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    const reduce = settings.reducedMotion === 'on' || (settings.reducedMotion === 'system' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    root.dataset.motion = reduce ? 'reduced' : 'full';
  }, [settings.textSize, settings.highContrast, settings.reducedMotion]);

  const first = route.segments[0] ?? '';
  const active = (p: string) => (p === '/' ? first === '' : `/${first}` === p || (p === '/endless' && first === 'play'));

  let screen: React.ReactNode;
  switch (first) {
    case '':
      screen = <Home />;
      break;
    case 'endless':
      screen = <EndlessSetup preset={route.query.get('focus')} />;
      break;
    case 'play':
      screen = <EndlessSession />;
      break;
    case 'daily':
      screen = <DailyScreen />;
      break;
    case 'dashboard':
      screen = <Dashboard />;
      break;
    case 'history':
      screen = <HistoryScreen />;
      break;
    case 'replay':
      screen = <ReplayScreen refKey={route.segments[1] ?? ''} />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    case 'mysteries':
      screen = route.segments[1] ? <CaseScreen caseId={route.segments[1]} /> : <MysteryList />;
      break;
    default:
      screen = (
        <div className="screen narrow">
          <h1>Page not found</h1>
          <p>
            <a href={href('/')}>Return to the vault entrance</a>
          </p>
        </div>
      );
  }

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href={href('/')} aria-label="MINDVAULT home">
          <Icon name="vault" size={22} />
          <span>MINDVAULT</span>
        </a>
        <nav aria-label="Main">
          <ul className="nav">
            {NAV.map((n) => (
              <li key={n.path}>
                <a href={href(n.path)} className={active(n.path) ? 'is-active' : undefined} aria-current={active(n.path) ? 'page' : undefined}>
                  <Icon name={n.icon} />
                  <span className="nav-label">{n.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {game.storageWarning && (
        <div className="banner banner-warning" role="status">
          {game.storageWarning}
        </div>
      )}
      <main id="main" tabIndex={-1}>
        <ScreenBoundary routeKey={route.segments.join('/')}>
          <Suspense fallback={<div className="screen loading">Opening the case files…</div>}>{screen}</Suspense>
        </ScreenBoundary>
      </main>
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {game.toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role="status">
            <div>
              <strong>{t.title}</strong>
              {t.body && <p>{t.body}</p>}
            </div>
            <button type="button" className="icon-btn" onClick={() => game.dismissToast(t.id)} aria-label="Dismiss notification">
              <Icon name="cross" size={16} />
            </button>
          </div>
        ))}
      </div>
      <footer className="footer">
        <p>
          MINDVAULT generates every endless puzzle locally from verified rule systems. Statistics are for practice and fun — they are not an IQ score or a validated measure of intelligence.
        </p>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
