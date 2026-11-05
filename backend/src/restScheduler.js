'use strict';

// Keeps at most ONE pending "rest is over" push per user: ticking the next set
// replaces the previous timer. Timers live in memory, which is fine for a single
// server instance. `send` and the timer functions are injected so this can be tested.
function createScheduler({ send, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const pending = new Map(); // userId -> { handle, dueAt }

  function cancel(userId) {
    const entry = pending.get(userId);
    if (!entry) return false;
    clearTimer(entry.handle);
    pending.delete(userId);
    return true;
  }

  function schedule(userId, seconds, payload) {
    cancel(userId);
    const dueAt = Date.now() + seconds * 1000;
    const handle = setTimer(async () => {
      pending.delete(userId);
      try {
        await send(userId, payload);
      } catch (err) {
        console.error('[push] sending the rest notification failed:', err.message);
      }
    }, seconds * 1000);
    if (handle && typeof handle.unref === 'function') handle.unref(); // don't block shutdown
    pending.set(userId, { handle, dueAt });
    return dueAt;
  }

  return { schedule, cancel, size: () => pending.size };
}

module.exports = { createScheduler };
