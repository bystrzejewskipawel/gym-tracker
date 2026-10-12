import { useNow } from '../useNow.js';
import { fmtTime } from '../sessionUtils.js';

// Counts up since the last completed set.
// Green: within suggested rest. Amber: up to 60s over. Red: more than 60s over.
export default function RestTimer({ timer, onClear }) {
  const now = useNow();
  if (!timer) return null;

  const elapsed = Math.floor((now - timer.startedAt) / 1000);
  const over = elapsed - timer.target;
  const status = over <= 0 ? 'green' : over <= 60 ? 'amber' : 'red';
  const message =
    status === 'green'
      ? `${fmtTime(timer.target - elapsed)} left`
      : `+${fmtTime(over)} over`;

  return (
    <div className={`rest-timer ${status}`}>
      <div>
        <div className="rest-label">{timer.label}</div>
        <div className="rest-sub">
          target {fmtTime(timer.target)} · {message}
        </div>
      </div>
      <div className="rest-time">{fmtTime(elapsed)}</div>
      <button type="button" className="ghost" onClick={onClear}>
        Skip
      </button>
    </div>
  );
}
