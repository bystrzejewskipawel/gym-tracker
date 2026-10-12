import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtTime } from '../sessionUtils.js';

function ExerciseRow({ ex, onChanged }) {
  const [rest, setRest] = useState(ex.restSeconds ?? 90);
  useEffect(() => setRest(ex.restSeconds ?? 90), [ex.restSeconds]);

  const saveRest = async () => {
    const value = Number(rest);
    if (!Number.isFinite(value) || value === ex.restSeconds) return;
    await api.updateExercise(ex._id, { restSeconds: value });
    onChanged();
  };

  const toggleAsym = async (e) => {
    await api.updateExercise(ex._id, { asymmetrical: e.target.checked });
    onChanged();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this exercise? Past sessions will keep the recorded name.')) return;
    await api.deleteExercise(ex._id);
    onChanged();
  };

  return (
    <li className="ex-row">
      <div className="ex-row-top">
        <span>
          <strong>{ex.name}</strong> <span className="muted">· {ex.category}</span>
        </span>
        <button className="link" onClick={handleDelete}>
          delete
        </button>
      </div>
      <div className="ex-row-settings">
        <label className="inline small">
          Rest (s)
          <input
            type="number"
            min="0"
            max="1800"
            step="5"
            value={rest}
            onChange={(e) => setRest(e.target.value)}
            onBlur={saveRest}
            style={{ width: 80, minWidth: 0, flex: 'none' }}
          />
          <span className="muted">({fmtTime(Number(rest) || 0)})</span>
        </label>
        <label className="inline small">
          <input type="checkbox" checked={!!ex.asymmetrical} onChange={toggleAsym} />
          One side at a time (L/R)
        </label>
      </div>
    </li>
  );
}

export default function ExerciseManager({ exercises, onChanged }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [restSeconds, setRestSeconds] = useState(90);
  const [asymmetrical, setAsymmetrical] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createExercise({ name, category, restSeconds: Number(restSeconds), asymmetrical });
      setName('');
      setCategory('');
      setRestSeconds(90);
      setAsymmetrical(false);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <h2>Exercises</h2>
      <form onSubmit={handleAdd}>
        <div className="row">
          <input
            placeholder="Exercise name (e.g. Bench Press)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            placeholder="Category (optional)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
        <div className="row">
          <label className="inline small">
            Suggested rest (s)
            <input
              type="number"
              min="0"
              max="1800"
              step="5"
              value={restSeconds}
              onChange={(e) => setRestSeconds(e.target.value)}
              style={{ width: 90, minWidth: 0, flex: 'none' }}
            />
          </label>
          <label className="inline small">
            <input
              type="checkbox"
              checked={asymmetrical}
              onChange={(e) => setAsymmetrical(e.target.checked)}
            />
            One side at a time (L/R)
          </label>
          <button type="submit">Add</button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}

      <ul className="list">
        {exercises.map((ex) => (
          <ExerciseRow key={ex._id} ex={ex} onChanged={onChanged} />
        ))}
        {exercises.length === 0 && <li className="muted">No exercises yet. Add one above.</li>}
      </ul>
    </div>
  );
}
