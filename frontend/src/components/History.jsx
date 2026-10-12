import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtSet, fmtTime } from '../sessionUtils.js';

const pad = (n) => String(n).padStart(2, '0');

// <input type="datetime-local"> wants local time as YYYY-MM-DDTHH:mm
function toLocalInput(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "3:25" -> 205. Empty -> 0. Anything else -> null (invalid).
function parseDuration(text) {
  const t = text.trim();
  if (t === '') return 0;
  const m = t.match(/^(\d+):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function SessionEditor({ session, exercises, onCancel, onSaved }) {
  const [date, setDate] = useState(toLocalInput(session.date));
  const [notes, setNotes] = useState(session.notes || '');
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState(() =>
    session.exercises.map((e) => ({
      exerciseId: e.exercise,
      exerciseName: e.exerciseName,
      duration: fmtTime(e.durationSeconds || 0),
      sets: e.sets.map((s) => ({ reps: String(s.reps), weight: String(s.weight), side: s.side || '' }))
    }))
  );

  const isAsym = (it) =>
    it.sets.some((s) => s.side) || !!exercises.find((x) => x._id === it.exerciseId)?.asymmetrical;

  const patchItem = (i, fn) => setItems((prev) => prev.map((it, idx) => (idx === i ? fn(it) : it)));

  const patchSet = (i, si, changes) =>
    patchItem(i, (it) => ({
      ...it,
      sets: it.sets.map((s, idx) => (idx === si ? { ...s, ...changes } : s))
    }));

  const addSet = (i) =>
    patchItem(i, (it) => {
      const last = it.sets[it.sets.length - 1];
      const side = isAsym(it) ? (last?.side === 'L' ? 'R' : 'L') : '';
      return {
        ...it,
        sets: [...it.sets, { reps: last?.reps ?? '', weight: last?.weight ?? '', side }]
      };
    });

  const removeSet = (i, si) =>
    patchItem(i, (it) => ({ ...it, sets: it.sets.filter((_, idx) => idx !== si) }));

  const addExercise = () => {
    const ex = exercises.find((x) => x._id === pick);
    if (!ex || items.some((it) => it.exerciseId === ex._id)) return;
    const blank = (side) => ({ reps: '', weight: '', side });
    setItems([
      ...items,
      {
        exerciseId: ex._id,
        exerciseName: ex.name,
        duration: '',
        sets: ex.asymmetrical ? [blank('L'), blank('R')] : [blank('')]
      }
    ]);
    setPick('');
  };

  const handleSave = async () => {
    setError('');
    const when = new Date(date);
    if (!date || Number.isNaN(when.getTime())) {
      setError('Please enter a valid date and time.');
      return;
    }

    const payload = [];
    for (const it of items) {
      if (it.sets.length === 0) continue; // an exercise with no sets is dropped
      const durationSeconds = parseDuration(it.duration);
      if (durationSeconds === null) {
        setError(`Time for ${it.exerciseName} should look like 3:25.`);
        return;
      }
      if (it.sets.some((s) => s.reps === '')) {
        setError(`Fill in the reps for every set of ${it.exerciseName}.`);
        return;
      }
      payload.push({
        exerciseId: it.exerciseId,
        exerciseName: it.exerciseName,
        durationSeconds,
        sets: it.sets.map((s) => ({
          reps: Number(s.reps),
          weight: Number(s.weight) || 0,
          side: s.side || null
        }))
      });
    }
    if (payload.length === 0) {
      setError('A session needs at least one exercise with sets. Use delete to remove the session.');
      return;
    }

    setSaving(true);
    try {
      await api.updateSession(session._id, { date: when.toISOString(), notes, exercises: payload });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const available = exercises.filter((x) => !items.some((it) => it.exerciseId === x._id));

  return (
    <div className="editor">
      <div className="editor-title">
        <strong>Edit session</strong>
      </div>

      <div className="row">
        <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <textarea
        placeholder="Session notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {items.map((it, i) => {
        const asym = isAsym(it);
        const cols = asym ? '1fr 1fr 72px 40px' : '1fr 1fr 40px';
        return (
          <div className="edit-ex" key={it.exerciseId}>
            <div className="edit-ex-head">
              <strong>{it.exerciseName}</strong>
              <span className="actions">
                <label className="inline small">
                  time
                  <input
                    placeholder="m:ss"
                    value={it.duration}
                    onChange={(e) => patchItem(i, (x) => ({ ...x, duration: e.target.value }))}
                    style={{ width: 72, minWidth: 0, flex: 'none', textAlign: 'center' }}
                  />
                </label>
                <button
                  type="button"
                  className="link"
                  onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                  aria-label="Remove exercise from session"
                >
                  ✕
                </button>
              </span>
            </div>

            <div className="edit-set muted small" style={{ gridTemplateColumns: cols }}>
              <span>reps</span>
              <span>kg</span>
              {asym && <span>side</span>}
              <span />
            </div>
            {it.sets.map((s, si) => (
              <div className="edit-set" style={{ gridTemplateColumns: cols }} key={si}>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={s.reps}
                  onChange={(e) => patchSet(i, si, { reps: e.target.value })}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={s.weight}
                  onChange={(e) => patchSet(i, si, { weight: e.target.value })}
                />
                {asym && (
                  <select value={s.side} onChange={(e) => patchSet(i, si, { side: e.target.value })}>
                    <option value="">–</option>
                    <option value="L">Left</option>
                    <option value="R">Right</option>
                  </select>
                )}
                <button type="button" className="link" onClick={() => removeSet(i, si)}>
                  ✕
                </button>
              </div>
            ))}
            <button type="button" className="ghost" onClick={() => addSet(i)}>
              + Set
            </button>
          </div>
        );
      })}

      {available.length > 0 && (
        <div className="row" style={{ marginTop: 14 }}>
          <select value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Add an exercise to this session…</option>
            {available.map((x) => (
              <option key={x._id} value={x._id}>
                {x.name}
              </option>
            ))}
          </select>
          <button type="button" className="row-btn ghost" onClick={addExercise} disabled={!pick}>
            Add
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className="row" style={{ marginBottom: 0, marginTop: 10 }}>
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function History({ exercises }) {
  const [sessions, setSessions] = useState([]);
  const [filterId, setFilterId] = useState('');
  const [editingId, setEditingId] = useState(null);

  const load = () => api.getSessions().then(setSessions);

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm('Delete this session?')) return;
    await api.deleteSession(id);
    if (editingId === id) setEditingId(null);
    load();
  };

  // `shown` is what the filter displays; the editor always works on the full session.
  const visible = sessions
    .map((s) => ({
      session: s,
      shown: filterId ? s.exercises.filter((e) => e.exercise === filterId) : s.exercises
    }))
    .filter((v) => !filterId || v.shown.length > 0);

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
        {visible.map(({ session, shown }) => (
          <li key={session._id} className="session-item">
            {editingId === session._id ? (
              <SessionEditor
                session={session}
                exercises={exercises}
                onCancel={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null);
                  load();
                }}
              />
            ) : (
              <>
                <div className="row space-between" style={{ marginBottom: 4 }}>
                  <strong>{new Date(session.date).toLocaleString()}</strong>
                  <span className="actions">
                    <button className="link neutral" onClick={() => setEditingId(session._id)}>
                      edit
                    </button>
                    <button className="link" onClick={() => handleDelete(session._id)}>
                      delete
                    </button>
                  </span>
                </div>
                {session.notes && <p className="muted small">{session.notes}</p>}
                <ul className="history-sets">
                  {shown.map((e, i) => (
                    <li key={i}>
                      <strong>{e.exerciseName}</strong>
                      {e.durationSeconds ? (
                        <span className="muted small"> · {fmtTime(e.durationSeconds)}</span>
                      ) : null}
                      <div className="muted">{e.sets.map(fmtSet).join(', ')}</div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
        {visible.length === 0 && <li className="muted">No sessions logged yet.</li>}
      </ul>
    </div>
  );
}
