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
import { summarizeSets } from '../sessionUtils.js';

const TOTAL_KEY = 'Set 1 total (reps × kg)';
const WEIGHT_KEY = 'Max weight (kg)';
const TOTAL_COLOR = '#22d3ee';
const WEIGHT_COLOR = '#a994ff';
const GRID = '#262d3f';
const TICK = { fontSize: 12 };

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
        const { maxWeight, firstSetTotal, assisted } = summarizeSets(entry.sets);
        return {
          date: new Date(entry.date).toLocaleDateString(),
          [TOTAL_KEY]: firstSetTotal,
          [WEIGHT_KEY]: maxWeight,
          assisted
        };
      });
  }, [history]);

  // Assisted exercises use negative weights, where reps × weight means nothing,
  // so only the weight line is shown for them.
  const hasAssist = chartData.some((d) => d.assisted);

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
        <>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="date" tick={{ ...TICK, fill: '#8b93a7' }} stroke={GRID} />
                {!hasAssist && (
                  <YAxis
                    yAxisId="left"
                    domain={['auto', 'auto']}
                    tick={{ ...TICK, fill: TOTAL_COLOR }}
                    stroke={GRID}
                    width={46}
                  />
                )}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={['auto', 'auto']}
                  tick={{ ...TICK, fill: WEIGHT_COLOR }}
                  stroke={GRID}
                  width={42}
                />
                <Tooltip
                  contentStyle={{
                    background: '#141821',
                    border: '1px solid #262d3f',
                    borderRadius: 10,
                    color: '#e8ebf2'
                  }}
                />
                <Legend wrapperStyle={{ color: '#8b93a7' }} />
                {!hasAssist && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey={TOTAL_KEY}
                    stroke={TOTAL_COLOR}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={WEIGHT_KEY}
                  stroke={WEIGHT_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="muted small" style={{ marginBottom: 0 }}>
            {hasAssist
              ? 'Assisted exercise: weight is the assistance (negative); closer to zero is better.'
              : 'Left axis: reps × weight of the first set only (for left/right exercises, both sides of set 1). Right axis: heaviest weight used.'}
          </p>
        </>
      )}
    </div>
  );
}
