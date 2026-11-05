#!/usr/bin/env node
// Prints a fresh VAPID key pair for Web Push (same format the web-push library uses).
// Run once:  npm run vapid   then put the three lines in backend/.env AND in Render's Environment tab.
// Keep the private key secret, and keep using the same pair: changing it unsubscribes every device.
'use strict';
const crypto = require('crypto');

const b64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();

let priv = ecdh.getPrivateKey();
if (priv.length < 32) priv = Buffer.concat([Buffer.alloc(32 - priv.length), priv]); // left-pad to 32 bytes

console.log(`VAPID_PUBLIC_KEY=${b64url(ecdh.getPublicKey())}`);
console.log(`VAPID_PRIVATE_KEY=${b64url(priv)}`);
console.log('VAPID_SUBJECT=mailto:you@example.com   # change to your own email');
