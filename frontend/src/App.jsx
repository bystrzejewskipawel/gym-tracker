import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import Login from './components/Login.jsx';
import ExerciseManager from './components/ExerciseManager.jsx';
import SessionForm from './components/SessionForm.jsx';
import History from './components/History.jsx';
import Progress from './components/Progress.jsx';
import RoutineManager from './components/RoutineManager.jsx';

const TABS = [
  { id: 'session', label: 'Session', icon: '🏋️' },
  { id: 'exercises', label: 'Exercises', icon: '📋' },
  { id: 'routines', label: 'Routines', icon: '🔁' },
  { id: 'history', label: 'History', icon: '🕘' },
  { id: 'progress', label: 'Progress', icon: '📈' }
];

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState('session');
  const [exercises, setExercises] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAll = () => {
    setLoadError('');
    Promise.all([api.getExercises().then(setExercises), api.getRoutines().then(setRoutines)]).catch(
      (err) => {
        console.error(err);
        // a 401 is handled by the listener below (back to the login screen)
        if (err.status !== 401) setLoadError(err.message || 'Could not reach the server');
      }
    );
  };

  // The API rejected our token (expired after 30 days, or the server secret changed).
  // An unfinished session is kept in this browser and can be resumed after logging in again.
  useEffect(() => {
    const onUnauthorized = () => {
      setNotice('Your login expired. Please log in again. An unfinished session is kept.');
      setAuthed(false);
    };
    window.addEventListener('gymtracker:unauthorized', onUnauthorized);
    return () => window.removeEventListener('gymtracker:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (authed) loadAll();
  }, [authed, refreshKey]);

  const bump = () => setRefreshKey((k) => k + 1);

  const handleLogout = () => {
    setToken(null);
    setAuthed(false);
  };

  if (!authed) {
    return (
      <Login
        notice={notice}
        onLoggedIn={() => {
          setNotice('');
          setAuthed(true);
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Gym Tracker</h1>
        <button className="link" onClick={handleLogout}>
          log out
        </button>
      </header>

      {loadError && (
        <div className="card resume-card">
          <strong>Can't load data from the server</strong>
          <p className="muted small">
            {loadError}. Free hosting can take up to a minute to wake up, so try again in a moment.
          </p>
          <button type="button" onClick={loadAll}>
            Retry
          </button>
        </div>
      )}

      <main>
        {/* The session tab stays mounted so an in-progress workout (and its
            timers) isn't lost when you peek at another tab. */}
        <div style={{ display: tab === 'session' ? 'block' : 'none' }}>
          <SessionForm exercises={exercises} routines={routines} onSaved={bump} />
        </div>
        {tab === 'exercises' && <ExerciseManager exercises={exercises} onChanged={bump} />}
        {tab === 'routines' && (
          <RoutineManager exercises={exercises} routines={routines} onChanged={bump} />
        )}
        {tab === 'history' && <History exercises={exercises} key={refreshKey} />}
        {tab === 'progress' && <Progress exercises={exercises} />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
