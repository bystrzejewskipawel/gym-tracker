import { useState } from 'react';
import { api } from '../api';
import { fmtTime } from '../sessionUtils.js';

const DEFAULT_REST = 180;

function ExerciseRow({ ex, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const startEdit = () => {
    setForm({
      name: ex.name,
      category: ex.category || '',
      restSeconds: ex.restSeconds ?? DEFAULT_REST,
      asymmetrical: !!ex.asymmetrical
    });
    setError('');
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.updateExercise(ex._id, { ...form, restSeconds: Number(form.restSeconds) });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this exercise? Past sessions will keep the recorded name.')) return;
    await api.deleteExercise(ex._id);
    onChanged();
  };

  if (editing) {
    return (
      <li>
        <form className="editor" onSubmit={save}>
          <div className="editor-title">
            <strong>Edit exercise</strong>
          </div>
          <div className="edit-form-grid">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              placeholder="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <label className="inline small">
              Suggested rest (s)
              <input
                type="number"
                min="0"
                max="1800"
                step="5"
                value={form.restSeconds}
                onChange={(e) => setForm({ ...form, restSeconds: e.target.value })}
                style={{ width: 90, minWidth: 0, flex: 'none' }}
              />
              <span className="muted">({fmtTime(Number(form.restSeconds) || 0)})</span>
            </label>
            <label className="inline small">
              <input
                type="checkbox"
                checked={form.asymmetrical}
                onChange={(e) => setForm({ ...form, asymmetrical: e.target.checked })}
              />
              One side at a time (L/R)
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="row" style={{ marginBottom: 0 }}>
            <button type="submit">Save</button>
            <button type="button" className="ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li>
      <div className="ex-row-top">
        <span>
          <strong>{ex.name}</strong> <span className="muted">· {ex.category}</span>
        </span>
        <span className="actions">
          <button className="link neutral" onClick={startEdit}>
            edit
          </button>
          <button className="link" onClick={handleDelete}>
            delete
          </button>
        </span>
      </div>
      <div className="muted small" style={{ marginTop: 4 }}>
        Rest {fmtTime(ex.restSeconds ?? DEFAULT_REST)}
        {ex.asymmetrical ? ' · Left / Right' : ''}
      </div>
    </li>
  );
}

export default function ExerciseManager({ exercises, onChanged }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST);
  const [asymmetrical, setAsymmetrical] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createExercise({ name, category, restSeconds: Number(restSeconds), asymmetrical });
      setName('');
      setCategory('');
      setRestSeconds(DEFAULT_REST);
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
