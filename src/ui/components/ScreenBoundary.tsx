/**
 * Catches errors while loading or rendering a screen (for example a lazy
 * chunk that cannot be fetched) so the rest of the app stays usable.
 * Resets when the route changes.
 */
import { Component, type ReactNode } from 'react';
import { href } from '../router';

interface Props {
  routeKey: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  routeKey: string;
}

export class ScreenBoundary extends Component<Props, State> {
  state: State = { error: null, routeKey: this.props.routeKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.routeKey !== state.routeKey ? { error: null, routeKey: props.routeKey } : null;
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const loading = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(error.message);
    return (
      <div className="screen narrow panel error-panel" role="alert">
        <h1>{loading ? 'This screen could not be loaded' : 'Something went wrong on this screen'}</h1>
        <p>
          {loading
            ? 'Its files could not be fetched — you may be offline, or a new version was released since this page was opened.'
            : 'Your progress is saved. You can try again or go back to the home screen.'}
        </p>
        <p className="muted small">{error.message}</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a className="btn btn-secondary" href={href('/')}>
            Home
          </a>
        </div>
      </div>
    );
  }
}
