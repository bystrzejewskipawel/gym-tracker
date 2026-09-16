import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { api } from '../api';

// For a given session's sets, the two numbers most worth tracking over time:
// the heaviest weight lifted, and the total volume (reps * weight summed).
function summarizeSets(sets) {
  const maxWeight = sets.reduce((max, s) => Math.max(max, s.weight), 0);
  const volume = sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
  return { maxWeight, volume };
}

export default function Progress({ exercises }) {
  const [exerciseId, setExerciseId] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (exercises.length > 0 && !exerciseId) {
      setExerciseId(exercises[0]._id);
    }
  }, [exercises]);

  useEffect(() => {
    if (!exerciseId) return;
    setLoading(true);
    api
      .getExerciseHistory(exerciseId)
      .then(setHistory)
      .finally(() => setLoading(false));
  }, [exerciseId]);

  const chartData = useMemo(() => {
    return [...history]
      .reverse() // history comes newest-first; charts read left-to-right chronologically
      .map((entry) => {
        const { maxWeight, volume } = summarizeSets(entry.sets);
        return {
          date: new Date(entry.date).toLocaleDateString(),
          'Max weight (kg)': maxWeight,
          'Total volume (kg)': volume
        };
      });
  }, [history]);

  return (
    <div className="card">
      <h2>Progress</h2>
      <div className="row">
        <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
          {exercises.map((ex) => (
            <option key={ex._id} value={ex._id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="muted">Loading...</p>}

      {!loading && chartData.length === 0 && (
        <p className="muted">No sessions logged for this exercise yet.</p>
      )}

      {!loading && chartData.length > 0 && (
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Max weight (kg)" stroke="#2b6cff" strokeWidth={2} />
              <Line type="monotone" dataKey="Total volume (kg)" stroke="#ff8a2b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
