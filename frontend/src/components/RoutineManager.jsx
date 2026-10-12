import { useState } from 'react';
import { api } from '../api';
import { groupItems } from '../sessionUtils.js';

// Keeps superset links valid: the last item can't link forward, and an item
// already linked from the one above can't also link forward (pairs only).
function normalize(items) {
  const out = [];
  items.forEach((it, i) => {
    const prevLinked = out[i - 1]?.linkNext;
    out.push({ ...it, linkNext: i === items.length - 1 || prevLinked ? false : it.linkNext });
  });
  return out;
}

export default function RoutineManager({ exercises, routines, onChanged }) {
  const [name, setName] = useState('');
  const [items, setItems] = useState([]); // { exerciseId, name, sets, linkNext }
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');

  const update = (next) => setItems(normalize(next));

  const addItem = () => {
    const ex = exercises.find((e) => e._id === pick);
    if (!ex || items.some((i) => i.exerciseId === ex._id)) return;
    update([...items, { exerciseId: ex._id, name: ex.name, sets: 3, linkNext: false }]);
    setPick('');
  };

  const patch = (index, changes) =>
    update(items.map((it, i) => (i === index ? { ...it, ...changes } : it)));

  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    let group = 0;
    const payloadItems = items.map((it, i) => {
      let superset = null;
      if (it.linkNext) {
        group += 1;
        superset = group;
      } else if (items[i - 1]?.linkNext) {
        superset = group;
      }
      return { exerciseId: it.exerciseId, sets: Number(it.sets) || 3, superset };
    });

    try {
      await api.createRoutine({ name, items: payloadItems });
      setName('');
      setItems([]);
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

  const available = exercises.filter((e) => !items.some((i) => i.exerciseId === e._id));

  return (
    <div className="card">
      <h2>Routines</h2>
      <p className="muted small">
        A routine sets the exercise order and number of sets. Tick “superset with next” to pair an
        exercise with the one below it: A1 → B1 → rest → A2 → B2 …
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

        <div className="row">
          <select value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Add an exercise…</option>
            {available.map((ex) => (
              <option key={ex._id} value={ex._id}>
                {ex.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={addItem} disabled={!pick}>
            Add
          </button>
        </div>

        {items.map((it, i) => {
          const inSuperset = it.linkNext || items[i - 1]?.linkNext;
          return (
            <div key={it.exerciseId} className={`builder-row ${inSuperset ? 'in-superset' : ''}`}>
              <div className="builder-main">
                <strong>{it.name}</strong>
                <label className="inline small">
                  sets
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={it.sets}
                    onChange={(e) => patch(i, { sets: e.target.value })}
                    style={{ width: 64, minWidth: 0, flex: 'none' }}
                  />
                </label>
              </div>
              <div className="builder-actions">
                <label className="inline small">
                  <input
                    type="checkbox"
                    checked={it.linkNext}
                    disabled={i === items.length - 1 || !!items[i - 1]?.linkNext}
                    onChange={(e) => patch(i, { linkNext: e.target.checked })}
                  />
                  superset with next
                </label>
                <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="link"
                  onClick={() => update(items.filter((_, idx) => idx !== i))}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={items.length === 0}>
          Save routine
        </button>
      </form>

      <ul className="list" style={{ marginTop: 16 }}>
        {routines.map((r) => (
          <li key={r._id} className="routine-item">
            <div className="ex-row-top">
              <strong>{r.name}</strong>
              <button className="link" onClick={() => handleDelete(r._id)}>
                delete
              </button>
            </div>
            <div className="chips">
              {groupItems((r.items || []).filter((i) => i.exercise)).map((g, gi) => (
                <span key={gi} className={`chip ${g.length > 1 ? 'chip-superset' : ''}`}>
                  {g.map((i) => `${i.exercise.name} ×${i.sets}`).join(' ⟷ ')}
                </span>
              ))}
              {(!r.items || r.items.length === 0) && (
                <span className="muted small">Empty (older routine, please recreate it)</span>
              )}
            </div>
          </li>
        ))}
        {routines.length === 0 && <li className="muted">No routines saved yet.</li>}
      </ul>
    </div>
  );
}
