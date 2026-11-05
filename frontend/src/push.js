import { api } from './api';

// Browser side of the "rest is over" notifications. The server sends the push; the service
// worker (public/sw.js) decides whether to show it (only when the app isn't on screen).

let enabled = false; // is push switched on for this device? (kept in sync by getPushState/enable/disable)
let keyInfo = null;
let watching = false;

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

async function getKeyInfo() {
  if (!keyInfo) keyInfo = await api.pushKey();
  return keyInfo;
}

async function getRegistration() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('The service worker is not ready. Reload the page and try again.')), 8000)
    )
  ]);
}

// When you come back to the app, remove a rest notification that is still in the shade.
function watchVisibility() {
  if (watching) return;
  watching = true;
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const shown = reg ? await reg.getNotifications({ tag: 'rest-timer' }) : [];
      shown.forEach((n) => n.close());
    } catch {
      /* not important */
    }
  });
}

// 'unsupported' | 'unconfigured' | 'blocked' | 'off' | 'on'
export async function getPushState() {
  if (!isPushSupported()) return 'unsupported';
  let info;
  try {
    info = await getKeyInfo();
  } catch {
    return 'unconfigured'; // server unreachable or too old
  }
  if (!info.enabled) return 'unconfigured';
  if (Notification.permission === 'denied') return 'blocked';

  try {
    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (Notification.permission === 'granted' && sub) {
      enabled = true;
      watchVisibility();
      api.pushSubscribe(sub.toJSON()).catch(() => {}); // keep the server's copy fresh
      return 'on';
    }
  } catch {
    /* fall through */
  }
  enabled = false;
  return 'off';
}

// Must be called from a click: the browser only asks for permission after a user gesture.
export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';

  const { publicKey } = await getKeyInfo();
  const keyBytes = urlBase64ToUint8Array(publicKey);
  const reg = await getRegistration();

  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameBytes(new Uint8Array(sub.options.applicationServerKey || []), keyBytes)) {
    await sub.unsubscribe(); // made with a different key (e.g. keys were regenerated)
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
  }
  await api.pushSubscribe(sub.toJSON());
  enabled = true;
  watchVisibility();
  return 'on';
}

export async function disablePush() {
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api.pushUnsubscribe(sub.endpoint).catch(() => {});
    await sub.unsubscribe();
  }
  api.pushCancelRest().catch(() => {});
  enabled = false;
  return 'off';
}

// ---- used by the session screen ----------------------------------------------

export function scheduleRestPush({ seconds, title, body }) {
  if (!enabled || !(seconds >= 5)) return;
  api
    .pushRest({ seconds: Math.round(seconds), title, body })
    .catch((err) => console.warn('Could not schedule the rest notification:', err.message));
}

export function cancelRestPush() {
  if (!enabled) return;
  api.pushCancelRest().catch(() => {});
}

// Test button: schedules a notification in 10 s. Switch to another app to see it.
export function sendTestPush() {
  return api.pushRest({
    seconds: 10,
    title: 'Test notification',
    body: 'This is how "rest over" will look when the app is in the background.'
  });
}
