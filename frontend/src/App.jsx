import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import Login from './components/Login.jsx';
import ExerciseManager from './components/ExerciseManager.jsx';
import SessionForm from './components/SessionForm.jsx';
import History from './components/History.jsx';
import Progress from './components/Progress.jsx';
import RoutineManager from './components/RoutineManager.jsx';

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
      <header>
        <div className="row space-between">
          <h1>🏋️ Gym Tracker</h1>
          <button className="link" onClick={handleLogout}>
            log out
          </button>
        </div>
        <nav>
          <button className={tab === 'session' ? 'active' : ''} onClick={() => setTab('session')}>
            New Session
          </button>
          <button className={tab === 'exercises' ? 'active' : ''} onClick={() => setTab('exercises')}>
            Exercises
          </button>
          <button className={tab === 'routines' ? 'active' : ''} onClick={() => setTab('routines')}>
            Routines
          </button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
            History
          </button>
          <button className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')}>
            Progress
          </button>
        </nav>
      </header>

      <main>
        {tab === 'session' && <SessionForm exercises={exercises} routines={routines} onSaved={bump} />}
        {tab === 'exercises' && <ExerciseManager exercises={exercises} onChanged={bump} />}
        {tab === 'routines' && (
          <RoutineManager exercises={exercises} routines={routines} onChanged={bump} />
        )}
        {tab === 'history' && <History exercises={exercises} key={refreshKey} />}
        {tab === 'progress' && <Progress exercises={exercises} />}
      </main>
    </div>
  );
}
