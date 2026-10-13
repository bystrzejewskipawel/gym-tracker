import { fmtSet, fmtTime } from '../sessionUtils.js';

// The sets editor for one exercise. Grey numbers = prefilled from the last
// session (they turn white once edited, and are saved either way).
export default function ExerciseBlock({
  block,
  label,
  onToggleSet,
  onChangeSet,
  onAddSet,
  onRemoveSet
}) {
  const sideCounts = {};

  return (
    <div className="ex-block">
      <div className="ex-block-head">
        <strong>
          {label && <span className="ab-label">{label}</span>}
          {block.name}
        </strong>
        {block.asymmetrical && <span className="badge">Left / Right</span>}
        <span className="muted small">rest {fmtTime(block.restSeconds)}</span>
      </div>

      <p className="muted small last-line">
        {block.lastDate
          ? `Last time (${new Date(block.lastDate).toLocaleDateString()}): ${block.prevSets
              .map(fmtSet)
              .join(', ')}`
          : 'No previous history for this exercise yet.'}
      </p>

      <div className="set-table">
        {block.sets.map((set) => {
          const key = set.side || 'x';
          sideCounts[key] = (sideCounts[key] || 0) + 1;
          const n = sideCounts[key];
          return (
            <div className={`set-row ${set.completed ? 'completed' : ''}`} key={set.id}>
              <span className="set-label">
                Set {n}
                {set.side && (
                  <span className={`side side-${set.side}`}>
                    {set.side === 'L' ? 'Left' : 'Right'}
                  </span>
                )}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="reps"
                className={set.prefilled ? 'prefilled' : ''}
                value={set.reps}
                onFocus={(e) => e.target.select()}
                onChange={(e) => onChangeSet(set.id, 'reps', e.target.value)}
              />
              <input
                type="number"
                step="0.5"
                placeholder="kg"
                className={set.prefilled ? 'prefilled' : ''}
                value={set.weight}
                onFocus={(e) => e.target.select()}
                onChange={(e) => onChangeSet(set.id, 'weight', e.target.value)}
              />
              <button
                type="button"
                className={`check-btn ${set.completed ? 'on' : ''}`}
                onClick={() => onToggleSet(set.id)}
                aria-label={set.completed ? 'Mark set not done' : 'Mark set done'}
              >
                ✓
              </button>
            </div>
          );
        })}
      </div>

      <div className="row" style={{ marginTop: 10, marginBottom: 0 }}>
        <button type="button" className="ghost" onClick={onAddSet}>
          + Set{block.asymmetrical ? ' (L+R)' : ''}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={onRemoveSet}
          disabled={block.sets.length === 0}
        >
          − Set
        </button>
      </div>
    </div>
  );
}
