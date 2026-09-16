import { useEffect, useState } from 'react';
import { api } from '../api';

export default function History({ exercises }) {
  const [sessions, setSessions] = useState([]);
  const [filterId, setFilterId] = useState('');

  const load = () => api.getSessions().then(setSessions);

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this session?')) return;
    await api.deleteSession(id);
    load();
  };

  const visible = sessions
    .map((s) => ({
      ...s,
      exercises: filterId ? s.exercises.filter((e) => e.exercise === filterId) : s.exercises
    }))
    .filter((s) => !filterId || s.exercises.length > 0);

  return (
    <div className="card">
      <h2>Session History</h2>

      <div className="row">
        <label className="muted">Filter by exercise:</label>
        <select value={filterId} onChange={(e) => setFilterId(e.target.value)}>
          <option value="">All exercises</option>
          {exercises.map((ex) => (
            <option key={ex._id} value={ex._id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      <ul className="list">
        {visible.map((session) => (
          <li key={session._id} className="session-item">
            <div className="row space-between">
              <strong>{new Date(session.date).toLocaleString()}</strong>
              <button className="link" onClick={() => handleDelete(session._id)}>
                delete
              </button>
            </div>
            {session.notes && <p className="muted small">{session.notes}</p>}
            <ul>
              {session.exercises.map((e, i) => (
                <li key={i}>
                  {e.exerciseName}: {e.sets.map((s) => `${s.reps}x${s.weight}kg`).join(', ')}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {visible.length === 0 && <li className="muted">No sessions logged yet.</li>}
      </ul>
    </div>
  );
}
