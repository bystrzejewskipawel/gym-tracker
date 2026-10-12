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

  const loadAll = () => {
    api.getExercises().then(setExercises).catch(console.error);
    api.getRoutines().then(setRoutines).catch(console.error);
  };

  useEffect(() => {
    if (authed) loadAll();
  }, [authed, refreshKey]);

  const bump = () => setRefreshKey((k) => k + 1);

  const handleLogout = () => {
    setToken(null);
    setAuthed(false);
  };

  if (!authed) {
    return <Login onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Gym Tracker</h1>
        <button className="link" onClick={handleLogout}>
          log out
        </button>
      </header>

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
