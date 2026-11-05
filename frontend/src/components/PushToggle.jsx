import { useEffect, useState } from 'react';
import { disablePush, enablePush, getPushState, sendTestPush } from '../push.js';

const NOTES = {
  unsupported: "Rest notifications aren't available in this browser (they need HTTPS).",
  unconfigured: "Rest notifications aren't set up on the server yet.",
  blocked: 'Notifications are blocked for this site. Allow them in the browser settings.'
};

export default function PushToggle() {
  const [state, setState] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getPushState().then(setState);
  }, []);

  const toggle = async () => {
    setBusy(true);
    setMessage('');
    try {
      setState(state === 'on' ? await disablePush() : await enablePush());
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setMessage('');
    try {
      await sendTestPush();
      setMessage('Sent. Switch to another app now: it arrives in about 10 seconds.');
    } catch (err) {
      setMessage(err.message);
    }
  };

  if (state === 'loading') return null;
  if (NOTES[state]) return <p className="muted small push-row">{NOTES[state]}</p>;

  return (
    <div className="push-row">
      <div>
        <strong>🔔 Rest-over notification</strong>
        <div className="muted small">
          {state === 'on'
            ? 'On. Only sent when the app is not on screen.'
            : 'Get notified when the rest ends while the app is in the background.'}
        </div>
      </div>
      <div className="actions">
        {state === 'on' && (
          <button type="button" className="ghost" onClick={test} disabled={busy}>
            Test
          </button>
        )}
        <button type="button" className={state === 'on' ? 'ghost' : ''} onClick={toggle} disabled={busy}>
          {state === 'on' ? 'Turn off' : 'Turn on'}
        </button>
      </div>
      {message && <p className="muted small push-message">{message}</p>}
    </div>
  );
}
