import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { api } from '../api';
import { clearDraft, loadDraft, saveDraft } from '../draft.js';
import RestTimer from './RestTimer.jsx';
import SortableUnit from './SortableUnit.jsx';
import {
  addSetTo,
  describeDraft,
  groupItems,
  isUnitDone,
  removeLastSet,
  restoreUnits,
  startTiming,
  stopTiming,
  uid
} from '../sessionUtils.js';

// Builds the in-session state for one exercise: fetches the latest record so
// reps/weight can be prefilled, and creates the requested number of sets.
async function createBlock(exercise, setCount) {
  let history = [];
  try {
    history = await api.getExerciseHistory(exercise._id, 1);
  } catch {
    /* no history is fine */
  }
  const last = history[0];
  const prevSets = last ? last.sets : [];

  let count = setCount;
  if (!count) {
    // Ad-hoc exercise (not from a routine): reuse last session's set count, else 3.
    const perSide = exercise.asymmetrical ? Math.ceil(prevSets.length / 2) : prevSets.length;
    count = perSide || 3;
  }

  let sets = [];
  for (let i = 0; i < count; i++) sets = addSetTo(sets, exercise.asymmetrical, prevSets);

  return {
    exerciseId: exercise._id,
    name: exercise.name,
    asymmetrical: !!exercise.asymmetrical,
    restSeconds: exercise.restSeconds ?? 180,
    prevSets,
    lastDate: last ? last.date : null,
    sets,
    done: false
  };
}

const newUnit = (blocks) => ({ id: uid(), blocks, elapsedMs: 0, activeSince: null });

export default function SessionForm({ exercises, routines, onSaved }) {
  const [units, setUnits] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [restTimer, setRestTimer] = useState(null);
  const [pickerValue, setPickerValue] = useState('');
  const [routineValue, setRoutineValue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  // An unfinished session left in this browser (refresh, crash, discarded tab...)
  const [savedDraft, setSavedDraft] = useState(() => loadDraft());

  // ---- autosave ------------------------------------------------------------
  // Saved after every change, then refreshed every 15 s and whenever the page is
  // hidden or closed (the moment mobile browsers like to throw tabs away).
  const latest = useRef(null);
  latest.current = { startedAt, units, activeId, restTimer, notes };

  useEffect(() => {
    if (units.length > 0) saveDraft({ startedAt, units, activeId, restTimer, notes });
  }, [units, activeId, restTimer, notes, startedAt]);

  useEffect(() => {
    const flush = () => {
      if (latest.current.units.length > 0) saveDraft(latest.current);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const timer = setInterval(flush, 15000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // Empties the session and its draft (after saving, discarding, or removing the last exercise).
  const resetSession = () => {
    latest.current = { ...latest.current, units: [] }; // stop a pending autosave re-creating it
    clearDraft();
    setUnits([]);
    setActiveId(null);
    setRestTimer(null);
    setNotes('');
    setStartedAt(null);
  };

  const resumeDraft = () => {
    const d = savedDraft;
    const now = Date.now();
    setUnits(restoreUnits(d.units, d.savedAt, now));
    setActiveId(d.activeId ?? null);
    setNotes(d.notes || '');
    setStartedAt(d.startedAt || d.savedAt);
    // a rest timer from long ago would just show a huge red number
    setRestTimer(d.restTimer && now - d.restTimer.startedAt < 30 * 60 * 1000 ? d.restTimer : null);
    setSavedDraft(null);
  };

  const discardDraft = () => {
    if (!confirm('Discard the unfinished session? This cannot be undone.')) return;
    clearDraft();
    setSavedDraft(null);
  };

  // Starting a new session while an unfinished one is waiting replaces it.
  const confirmReplaceDraft = () => {
    if (!savedDraft) return true;
    if (!confirm('Starting a new session will discard the unfinished one. Continue?')) return false;
    clearDraft();
    setSavedDraft(null);
    return true;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const takenIds = () => new Set(units.flatMap((u) => u.blocks.map((b) => b.exerciseId)));

  // ---- active exercise & time tracking ------------------------------------

  // Makes a unit the open one: pauses the clock on the previous one, starts it
  // on this one. Activating a finished unit reopens it.
  const activate = (id) => {
    const now = Date.now();
    setUnits((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...startTiming(u, now), blocks: u.blocks.map((b) => ({ ...b, done: false })) }
          : stopTiming(u, now)
      )
    );
    setActiveId(id);
  };

  const appendUnits = (list) => {
    if (list.length === 0) return;
    setUnits((prev) => [...prev, ...list]);
    setStartedAt((prev) => prev ?? Date.now());
    if (!activeId) activate(list[0].id);
  };

  const markDone = (unitId) => {
    const now = Date.now();
    const idx = units.findIndex((u) => u.id === unitId);
    const next = [...units.slice(idx + 1), ...units.slice(0, idx)].find((u) => !isUnitDone(u));
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id === unitId) {
          return { ...stopTiming(u, now), blocks: u.blocks.map((b) => ({ ...b, done: true })) };
        }
        if (next && u.id === next.id) return startTiming(u, now);
        return u;
      })
    );
    setActiveId(next ? next.id : null);
  };

  const removeUnit = (unitId) => {
    if (units.length === 1) {
      resetSession();
      return;
    }
    setUnits((prev) => prev.filter((u) => u.id !== unitId));
    if (activeId === unitId) setActiveId(null);
  };

  // ---- adding exercises / routines ----------------------------------------

  const addExercise = async (exerciseId) => {
    const ex = exercises.find((e) => e._id === exerciseId);
    if (!ex || takenIds().has(exerciseId) || !confirmReplaceDraft()) return;
    setLoading(true);
    try {
      appendUnits([newUnit([await createBlock(ex)])]);
    } finally {
      setLoading(false);
    }
  };

  const loadRoutine = async (routineId) => {
    const routine = routines.find((r) => r._id === routineId);
    if (!routine || !confirmReplaceDraft()) return;
    const taken = takenIds();
    const groups = groupItems(routine.items.filter((i) => i.exercise));

    setLoading(true);
    try {
      const built = await Promise.all(
        groups.map(async (group) => {
          const fresh = group.filter((i) => !taken.has(i.exercise._id));
          if (fresh.length === 0) return null;
          const blocks = await Promise.all(fresh.map((i) => createBlock(i.exercise, i.sets)));
          return newUnit(blocks);
        })
      );
      appendUnits(built.filter(Boolean));
    } finally {
      setLoading(false);
    }
  };

  // ---- sets ---------------------------------------------------------------

  const updateBlock = (unitId, bi, fn) =>
    setUnits((prev) =>
      prev.map((u) =>
        u.id !== unitId ? u : { ...u, blocks: u.blocks.map((b, i) => (i === bi ? fn(b) : b)) }
      )
    );

  const changeSet = (unitId, bi, setId, field, value) =>
    updateBlock(unitId, bi, (b) => ({
      ...b,
      sets: b.sets.map((s) => (s.id === setId ? { ...s, [field]: value, prefilled: false } : s))
    }));

  const addSet = (unitId, bi) =>
    updateBlock(unitId, bi, (b) => ({ ...b, sets: addSetTo(b.sets, b.asymmetrical, b.prevSets) }));

  const removeSet = (unitId, bi) =>
    updateBlock(unitId, bi, (b) => ({ ...b, sets: removeLastSet(b.sets, b.asymmetrical) }));

  // Completing a set starts the rest timer. In a superset, the timer only starts
  // after the last exercise of the round (A -> B -> rest), using the longer rest.
  const toggleSet = (unitId, bi, setId) => {
    const unit = units.find((u) => u.id === unitId);
    const set = unit.blocks[bi].sets.find((s) => s.id === setId);
    const completing = !set.completed;

    if (completing && set.reps === '') {
      setError('Enter the reps before marking a set done.');
      return;
    }
    setError('');

    updateBlock(unitId, bi, (b) => ({
      ...b,
      sets: b.sets.map((s) => (s.id === setId ? { ...s, completed: completing } : s))
    }));

    if (completing) {
      const isLastInUnit = bi === unit.blocks.length - 1;
      if (isLastInUnit) {
        setRestTimer({
          startedAt: Date.now(),
          target: Math.max(...unit.blocks.map((b) => b.restSeconds)),
          label: unit.blocks.length > 1 ? 'Superset rest' : 'Rest'
        });
      } else {
        setRestTimer(null); // straight on to the next exercise in the superset
      }
    }
  };

  // ---- drag & drop --------------------------------------------------------

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setUnits((prev) =>
      arrayMove(
        prev,
        prev.findIndex((u) => u.id === active.id),
        prev.findIndex((u) => u.id === over.id)
      )
    );
  };

  // ---- saving -------------------------------------------------------------

  const completedCount = units.reduce(
    (n, u) => n + u.blocks.reduce((m, b) => m + b.sets.filter((s) => s.completed).length, 0),
    0
  );

  const handleSave = async () => {
    setError('');
    const now = Date.now();
    const payload = [];

    units.forEach((u) => {
      // Superset time is shared between its two exercises.
      const perBlock = Math.round(stopTiming(u, now).elapsedMs / 1000 / u.blocks.length);
      u.blocks.forEach((b) => {
        // Completed sets are saved with whatever is in the fields, including
        // untouched prefilled values.
        const sets = b.sets
          .filter((s) => s.completed)
          .map((s) => ({ reps: Number(s.reps), weight: Number(s.weight) || 0, side: s.side }));
        if (sets.length > 0) {
          payload.push({ exerciseId: b.exerciseId, durationSeconds: perBlock, sets });
        }
      });
    });

    if (payload.length === 0) {
      setError('Complete at least one set (tap ✓) before saving.');
      return;
    }

    setSaving(true);
    try {
      await api.createSession({
        date: new Date(startedAt || Date.now()).toISOString(),
        notes,
        exercises: payload
      });
      resetSession();
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <RestTimer timer={restTimer} onClear={() => setRestTimer(null)} />

      {savedDraft && (
        <div className="card resume-card">
          <strong>Unfinished session found</strong>
          <p className="muted small">{describeDraft(savedDraft)}</p>
          <div className="row" style={{ marginBottom: 0 }}>
            <button type="button" onClick={resumeDraft}>
              Resume
            </button>
            <button type="button" className="ghost" onClick={discardDraft}>
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>New Session</h2>

        {routines.length > 0 && (
          <div className="row">
            <select value={routineValue} onChange={(e) => setRoutineValue(e.target.value)}>
              <option value="">Start from a routine…</option>
              {routines.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="row-btn"
              disabled={!routineValue || loading}
              onClick={() => {
                loadRoutine(routineValue);
                setRoutineValue('');
              }}
            >
              Load
            </button>
          </div>
        )}

        <div className="row" style={{ marginBottom: 0 }}>
          <select value={pickerValue} onChange={(e) => setPickerValue(e.target.value)}>
            <option value="">Add a single exercise…</option>
            {exercises.map((ex) => (
              <option key={ex._id} value={ex._id}>
                {ex.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="row-btn"
            disabled={!pickerValue || loading}
            onClick={() => {
              addExercise(pickerValue);
              setPickerValue('');
            }}
          >
            Add
          </button>
        </div>
        {loading && <p className="muted small">Loading…</p>}
      </div>

      {units.length > 0 && (
        <p className="muted small hint">
          Drag ⋮⋮ to reorder · tap a title to open that exercise
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={units.map((u) => u.id)} strategy={verticalListSortingStrategy}>
          {units.map((unit) => (
            <SortableUnit
              key={unit.id}
              unit={unit}
              active={unit.id === activeId}
              onActivate={() => unit.id !== activeId && activate(unit.id)}
              onRemove={() => removeUnit(unit.id)}
              onMarkDone={() => markDone(unit.id)}
              onToggleSet={(bi, setId) => toggleSet(unit.id, bi, setId)}
              onChangeSet={(bi, setId, field, value) => changeSet(unit.id, bi, setId, field, value)}
              onAddSet={(bi) => addSet(unit.id, bi)}
              onRemoveSet={(bi) => removeSet(unit.id, bi)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {units.length > 0 && (
        <div className="card">
          <textarea
            placeholder="Session notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <button type="button" className="wide" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : `Finish & save session (${completedCount} sets)`}
          </button>
        </div>
      )}
      {units.length === 0 && error && <p className="error">{error}</p>}
    </div>
  );
}
