'use strict';
const { createScheduler } = require('./restScheduler');
const PushSubscription = require('./models/PushSubscription');

let webpush = null;
try {
  webpush = require('web-push');
} catch {
  console.warn('[push] the "web-push" package is not installed (run npm install). Push is off.');
}

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || process.env.FRONTEND_URL || 'mailto:admin@example.com';

let enabled = false;
if (webpush && publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    enabled = true;
    console.log('[push] rest notifications are on');
  } catch (err) {
    console.warn('[push] invalid VAPID configuration, push is off:', err.message);
  }
} else if (webpush) {
  console.log('[push] VAPID keys not set, rest notifications are off (run npm run vapid)');
}

// Sends one payload to every device the user has enabled notifications on.
async function sendToUser(userId, payload) {
  const subs = await PushSubscription.find({ user: userId });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
          JSON.stringify(payload),
          { TTL: 120, urgency: 'high' } // a late "rest is over" is useless; deliver now or drop
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: s._id }); // device unsubscribed / uninstalled
        } else {
          console.error('[push] send failed:', err.statusCode || '', err.message);
        }
      }
    })
  );
}

const scheduler = createScheduler({ send: sendToUser });

module.exports = {
  isEnabled: () => enabled,
  publicKey: () => publicKey,
  scheduler
};
