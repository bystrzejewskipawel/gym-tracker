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
