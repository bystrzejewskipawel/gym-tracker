import { getToken } from './api';

// The unfinished session is autosaved in this browser's localStorage (per account),
// so a refresh, a crash or the browser discarding the tab doesn't lose it.
const VERSION = 1;

function storageKey() {
  let id = 'anon';
  try {
    // the login token's payload holds the user id (base64url JSON)
    const part = getToken().split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    id = JSON.parse(atob(part)).userId || id;
  } catch {
    /* keep "anon" */
  }
  return `gymtracker_draft_${id}`;
}

export function saveDraft(draft) {
  try {
    localStorage.setItem(
      storageKey(),
      JSON.stringify({ ...draft, version: VERSION, savedAt: Date.now() })
    );
  } catch {
    /* storage full or blocked: nothing we can do */
  }
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.version === VERSION && Array.isArray(d.units) && d.units.length > 0 ? d : null;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(storageKey());
  } catch {
    /* ignore */
  }
}
