import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ExerciseBlock from './ExerciseBlock.jsx';
import { useNow } from '../useNow.js';
import { fmtTime, isUnitDone } from '../sessionUtils.js';

function UnitClock({ unit }) {
  const now = useNow();
  const ms = unit.elapsedMs + (unit.activeSince ? now - unit.activeSince : 0);
  return <span className="muted small">⏱ {fmtTime(ms / 1000)} on this exercise</span>;
}

// One entry in the session list: a single exercise, or a superset pair.
// Collapsed (title only) unless it's the active one.
export default function SortableUnit({
  unit,
  active,
  onActivate,
  onRemove,
  onMarkDone,
  onToggleSet,
  onChangeSet,
  onAddSet,
  onRemoveSet
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: unit.id });

  const done = isUnitDone(unit);
  const superset = unit.blocks.length > 1;
  const totalSets = unit.blocks.reduce((n, b) => n + b.sets.length, 0);
  const doneSets = unit.blocks.reduce((n, b) => n + b.sets.filter((s) => s.completed).length, 0);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : undefined
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`unit ${active ? 'active' : ''} ${done ? 'done' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      <div className="unit-header">
        <button
          type="button"
          className="drag-handle"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          ⋮⋮
        </button>

        <button type="button" className="unit-title" onClick={onActivate}>
          <span className="title-text">{unit.blocks.map((b) => b.name).join(' + ')}</span>
          <span className="unit-meta">
            {superset && <span className="badge">Superset</span>}
            {done ? (
              <span className="badge done">✓ Done · tap to reopen</span>
            ) : (
              <span className="muted small">
                {doneSets}/{totalSets} sets
              </span>
            )}
          </span>
        </button>

        <button type="button" className="link" onClick={onRemove} aria-label="Remove from session">
          ✕
        </button>
      </div>

      {active && !done && (
        <div className="unit-body">
          <UnitClock unit={unit} />
          {superset && (
            <p className="muted small">
              Order: A set 1 → B set 1 → rest → A set 2 → B set 2 → rest …
            </p>
          )}
          {unit.blocks.map((block, bi) => (
            <ExerciseBlock
              key={block.exerciseId}
              block={block}
              label={superset ? ['A', 'B'][bi] : null}
              onToggleSet={(setId) => onToggleSet(bi, setId)}
              onChangeSet={(setId, field, value) => onChangeSet(bi, setId, field, value)}
              onAddSet={() => onAddSet(bi)}
              onRemoveSet={() => onRemoveSet(bi)}
            />
          ))}
          <button type="button" className="done-btn" onClick={onMarkDone}>
            ✓ Mark exercise done
          </button>
        </div>
      )}
    </div>
  );
}
