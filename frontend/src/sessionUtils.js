let counter = 0;
export const uid = () => `u${Date.now().toString(36)}${(counter++).toString(36)}`;

export function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtSet(s) {
  const load = s.weight < 0 ? `${Math.abs(s.weight)}kg assist` : `${s.weight}kg`;
  return `${s.reps}×${load}${s.side ? ` (${s.side})` : ''}`;
}

// Groups routine items into display/session units: two adjacent items that
// share the same non-null `superset` id become one unit, everything else is alone.
export function groupItems(items) {
  const groups = [];
  items.forEach((it) => {
    const last = groups[groups.length - 1];
    if (it.superset != null && last && last[0].superset === it.superset) last.push(it);
    else groups.push([it]);
  });
  return groups;
}

// ---- sets & prefill -------------------------------------------------------

// Best matching set from the previous session: same side, same n-th occurrence,
// falling back to the last set of that side if the previous session had fewer.
function previousFor(prevSets, side, nth) {
  const same = prevSets.filter((p) => (p.side || null) === (side || null));
  if (same.length === 0) return null;
  return same[nth] ?? same[same.length - 1];
}

// `prefilled: true` means the value came from history and the user hasn't touched
// it. It is shown in grey, and still saved as-is when the set is completed.
export function buildSet(side, prevSets, existingSets) {
  const nth = existingSets.filter((s) => s.side === side).length;
  const prev = previousFor(prevSets, side, nth);
  return {
    id: uid(),
    side,
    reps: prev ? String(prev.reps) : '',
    weight: prev ? String(prev.weight) : '',
    prefilled: !!prev,
    completed: false
  };
}

// One-sided exercises get a Left and a Right row per set, so "3 sets" = 3 per side.
export function addSetTo(sets, asymmetrical, prevSets) {
  const out = [...sets];
  if (asymmetrical) {
    out.push(buildSet('L', prevSets, out));
    out.push(buildSet('R', prevSets, out));
  } else {
    out.push(buildSet(null, prevSets, out));
  }
  return out;
}

export function removeLastSet(sets, asymmetrical) {
  return sets.slice(0, asymmetrical ? -2 : -1);
}

// ---- unit helpers (a unit = one exercise, or a superset pair) --------------

export const isUnitDone = (unit) => unit.blocks.every((b) => b.done);

export function stopTiming(unit, now) {
  if (!unit.activeSince) return unit;
  return { ...unit, elapsedMs: unit.elapsedMs + (now - unit.activeSince), activeSince: null };
}

export function startTiming(unit, now) {
  return unit.activeSince ? unit : { ...unit, activeSince: now };
}

// ---- current set ------------------------------------------------------------

// The set to do next in an open unit: the first unfinished set in the order
// A set 1 -> B set 1 -> A set 2 -> ... (for a single exercise: simply the first unfinished set).
export function getCurrentSet(unit) {
  const rounds = Math.max(0, ...unit.blocks.map((b) => b.sets.length));
  for (let r = 0; r < rounds; r++) {
    for (let bi = 0; bi < unit.blocks.length; bi++) {
      const s = unit.blocks[bi].sets[r];
      if (s && !s.completed) return { blockIndex: bi, setId: s.id };
    }
  }
  return null;
}

// ---- draft (autosaved unfinished session) ------------------------------------

// Time that passed while the page was closed must not count as time on the exercise:
// count the open exercise up to the last autosave, then start the clock again from `now`.
export function restoreUnits(units, savedAt, now) {
  return units.map((u) =>
    u.activeSince
      ? { ...u, elapsedMs: u.elapsedMs + Math.max(0, savedAt - u.activeSince), activeSince: now }
      : u
  );
}

export function describeDraft(draft, now = new Date()) {
  const blocks = draft.units.flatMap((u) => u.blocks);
  const total = blocks.reduce((n, b) => n + b.sets.length, 0);
  const done = blocks.reduce((n, b) => n + b.sets.filter((s) => s.completed).length, 0);
  const started = new Date(draft.startedAt || draft.savedAt);
  const when =
    started.toDateString() === now.toDateString()
      ? `today at ${started.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : started.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  return `Started ${when} · ${blocks.length} exercise${blocks.length === 1 ? '' : 's'} · ${done}/${total} sets done`;
}

// ---- progress chart ----------------------------------------------------------

const round1 = (n) => Math.round(n * 10) / 10;

// `sets` are one session's sets for one exercise.
// firstSetTotal: reps x weight of the FIRST set only, so sessions with a different
// number of sets stay comparable. For one-sided exercises "set 1" is the first row
// of each side (L and R added together).
// maxWeight: heaviest weight used (for assisted exercises weights are negative,
// so -27 correctly counts as better than -32).
export function summarizeSets(sets) {
  const maxWeight = sets.length ? Math.max(...sets.map((s) => s.weight)) : 0;
  const seen = new Set();
  let firstSetTotal = 0;
  for (const s of sets) {
    const key = s.side || 'x';
    if (seen.has(key)) continue;
    seen.add(key);
    firstSetTotal += s.reps * s.weight;
  }
  return {
    maxWeight: round1(maxWeight),
    firstSetTotal: round1(firstSetTotal),
    assisted: sets.some((s) => s.weight < 0)
  };
}
