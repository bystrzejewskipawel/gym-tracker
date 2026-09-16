import { useEffect, useState } from 'react';
import { api } from '../api';

export default function ExerciseManager({ exercises, onChanged }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createExercise({ name, category });
      setName('');
      setCategory('');
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this exercise? Past sessions will keep the recorded name.')) return;
    await api.deleteExercise(id);
    onChanged();
  };

  return (
    <div className="card">
      <h2>Exercises</h2>
      <form onSubmit={handleAdd} className="row">
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
        <button type="submit">Add</button>
      </form>
      {error && <p className="error">{error}</p>}

      <ul className="list">
        {exercises.map((ex) => (
          <li key={ex._id}>
            <span>
              <strong>{ex.name}</strong> <span className="muted">({ex.category})</span>
            </span>
            <button className="link" onClick={() => handleDelete(ex._id)}>
              delete
            </button>
          </li>
        ))}
        {exercises.length === 0 && <li className="muted">No exercises yet. Add one above.</li>}
      </ul>
    </div>
  );
}
