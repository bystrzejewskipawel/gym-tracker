const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const PushSubscription = require('../models/PushSubscription');
const push = require('../push');

// GET /api/push/public-key - public; tells the browser whether push is set up
router.get('/public-key', (req, res) => {
  const enabled = push.isEnabled();
  res.json({ enabled, publicKey: enabled ? push.publicKey() : null });
});

// everything below needs a logged-in user
router.use(requireAuth);

// POST /api/push/subscribe  body: { subscription } (from PushSubscription.toJSON())
router.post('/subscribe', async (req, res) => {
  try {
    const sub = req.body.subscription;
    const valid =
      sub &&
      typeof sub.endpoint === 'string' &&
      sub.endpoint.startsWith('https://') &&
      sub.keys &&
      typeof sub.keys.p256dh === 'string' &&
      typeof sub.keys.auth === 'string';
    if (!valid) return res.status(400).json({ error: 'Invalid push subscription' });

    // upsert by endpoint: re-subscribing, or logging in as someone else on this browser, just updates it
    await PushSubscription.findOneAndUpdate(
      { endpoint: sub.endpoint },
      { user: req.userId, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/push/unsubscribe  body: { endpoint }
router.post('/unsubscribe', async (req, res) => {
  try {
    await PushSubscription.deleteOne({ endpoint: req.body.endpoint, user: req.userId });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/push/rest  body: { seconds, title, body }
// "Notify me in N seconds". A new call replaces the pending one for this user.
router.post('/rest', (req, res) => {
  if (!push.isEnabled()) {
    return res.status(503).json({ error: 'Push notifications are not set up on the server' });
  }
  const seconds = Math.round(Number(req.body.seconds));
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600) {
    return res.status(400).json({ error: 'seconds must be between 1 and 3600' });
  }
  const title = String(req.body.title || 'Rest over').slice(0, 80);
  const body = String(req.body.body || '').slice(0, 160);
  const dueAt = push.scheduler.schedule(String(req.userId), seconds, { title, body });
  res.json({ dueAt });
});

// DELETE /api/push/rest - cancel the pending notification (timer skipped, session saved...)
router.delete('/rest', (req, res) => {
  push.scheduler.cancel(String(req.userId));
  res.status(204).end();
});

module.exports = router;
