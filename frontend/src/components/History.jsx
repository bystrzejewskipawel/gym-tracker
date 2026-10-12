import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtSet, fmtTime } from '../sessionUtils.js';

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
            <div className="row space-between" style={{ marginBottom: 4 }}>
              <strong>{new Date(session.date).toLocaleString()}</strong>
              <button className="link" onClick={() => handleDelete(session._id)}>
                delete
              </button>
            </div>
            {session.notes && <p className="muted small">{session.notes}</p>}
            <ul className="history-sets">
              {session.exercises.map((e, i) => (
                <li key={i}>
                  <strong>{e.exerciseName}</strong>
                  {e.durationSeconds ? (
                    <span className="muted small"> · {fmtTime(e.durationSeconds)}</span>
                  ) : null}
                  <div className="muted">{e.sets.map(fmtSet).join(', ')}</div>
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
