import { useState } from 'react';
import { api } from '../api';

export default function RoutineManager({ exercises, routines, onChanged }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createRoutine({ name, exerciseIds: selected });
      setName('');
      setSelected([]);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this routine?')) return;
    await api.deleteRoutine(id);
    onChanged();
  };

  return (
    <div className="card">
      <h2>Routines</h2>
      <p className="muted small">
        Save a named group of exercises (e.g. "Push Day") so you can add them all to a session in
        one tap.
      </p>

      <form onSubmit={handleCreate}>
        <div className="row">
          <input
            placeholder="Routine name (e.g. Push Day)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {exercises.map((ex) => (
            <label key={ex._id} className="row" style={{ gap: 4, minWidth: 'auto' }}>
              <input
                type="checkbox"
                checked={selected.includes(ex._id)}
                onChange={() => toggle(ex._id)}
              />
              {ex.name}
            </label>
          ))}
          {exercises.length === 0 && <span className="muted">Add some exercises first.</span>}
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={exercises.length === 0}>
          Save routine
        </button>
      </form>

      <ul className="list" style={{ marginTop: 16 }}>
        {routines.map((r) => (
          <li key={r._id}>
            <span>
              <strong>{r.name}</strong>{' '}
              <span className="muted">({r.exercises.map((e) => e.name).join(', ')})</span>
            </span>
            <button className="link" onClick={() => handleDelete(r._id)}>
              delete
            </button>
          </li>
        ))}
        {routines.length === 0 && <li className="muted">No routines saved yet.</li>}
      </ul>
    </div>
  );
}
