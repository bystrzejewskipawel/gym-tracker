import { useEffect, useState } from 'react';
import { api } from '../api';

// One row in the session: a chosen exercise plus its sets, and the
// previous-session history fetched for it so the user can see what to beat.
function ExerciseBlock({ block, onChange, onRemove }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!block.exerciseId) return;
    api.getExerciseHistory(block.exerciseId).then(setHistory).catch(() => setHistory([]));
  }, [block.exerciseId]);

  const lastSession = history[0];

  const updateSet = (idx, field, value) => {
    const sets = block.sets.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
    onChange({ ...block, sets });
  };

  const addSet = () => onChange({ ...block, sets: [...block.sets, { reps: '', weight: '' }] });
  const removeSet = (idx) => onChange({ ...block, sets: block.sets.filter((_, i) => i !== idx) });

  return (
    <div className="exercise-block">
      <div className="row space-between">
        <strong>{block.name}</strong>
        <button type="button" className="link" onClick={onRemove}>
          remove
        </button>
      </div>

      {lastSession ? (
        <p className="muted small">
          Last time ({new Date(lastSession.date).toLocaleDateString()}):{' '}
          {lastSession.sets.map((s, i) => `${s.reps}x${s.weight}kg`).join(', ')}
        </p>
      ) : (
        <p className="muted small">No previous history for this exercise yet.</p>
      )}

      {block.sets.map((set, idx) => (
        <div className="row" key={idx}>
          <span className="muted">Set {idx + 1}</span>
          <input
            type="number"
            min="0"
            placeholder="reps"
            value={set.reps}
            onChange={(e) => updateSet(idx, 'reps', e.target.value)}
            required
          />
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="weight (kg)"
            value={set.weight}
            onChange={(e) => updateSet(idx, 'weight', e.target.value)}
            required
          />
          <button type="button" className="link" onClick={() => removeSet(idx)}>
            x
          </button>
        </div>
      ))}
      <button type="button" onClick={addSet}>
        + Add set
      </button>
    </div>
  );
}

export default function SessionForm({ exercises, routines, onSaved }) {
  const [blocks, setBlocks] = useState([]);
  const [pickerValue, setPickerValue] = useState('');
  const [routineValue, setRoutineValue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const addExerciseToSession = (exerciseId) => {
    const exercise = exercises.find((e) => e._id === exerciseId);
    if (!exercise) return;
    setBlocks((prev) => {
      if (prev.some((b) => b.exerciseId === exerciseId)) return prev; // already added
      return [...prev, { exerciseId, name: exercise.name, sets: [{ reps: '', weight: '' }] }];
    });
  };

  const addRoutineToSession = (routineId) => {
    const routine = routines.find((r) => r._id === routineId);
    if (!routine) return;
    routine.exercises.forEach((ex) => addExerciseToSession(ex._id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (blocks.length === 0) {
      setError('Add at least one exercise to the session.');
      return;
    }
    setSaving(true);
    try {
      await api.createSession({
        notes,
        exercises: blocks.map((b) => ({ exerciseId: b.exerciseId, sets: b.sets }))
      });
      setBlocks([]);
      setNotes('');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2>New Session</h2>

      {routines.length > 0 && (
        <div className="row">
          <select value={routineValue} onChange={(e) => setRoutineValue(e.target.value)}>
            <option value="">-- or start from a routine --</option>
            {routines.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (routineValue) addRoutineToSession(routineValue);
              setRoutineValue('');
            }}
          >
            Load routine
          </button>
        </div>
      )}

      <div className="row">
        <select value={pickerValue} onChange={(e) => setPickerValue(e.target.value)}>
          <option value="">-- pick an exercise to add --</option>
          {exercises.map((ex) => (
            <option key={ex._id} value={ex._id}>
              {ex.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (pickerValue) addExerciseToSession(pickerValue);
            setPickerValue('');
          }}
        >
          Add to session
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {blocks.map((block) => (
          <ExerciseBlock
            key={block.exerciseId}
            block={block}
            onChange={(updated) =>
              setBlocks(blocks.map((b) => (b.exerciseId === updated.exerciseId ? updated : b)))
            }
            onRemove={() => setBlocks(blocks.filter((b) => b.exerciseId !== block.exerciseId))}
          />
        ))}

        {blocks.length > 0 && (
          <>
            <textarea
              placeholder="Session notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {error && <p className="error">{error}</p>}
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save session'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
