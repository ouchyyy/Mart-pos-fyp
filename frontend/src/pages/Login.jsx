// The sign-in screen. Staff type a username like "admin".

import { useState } from 'react';
import { signIn } from '../database';

export default function Login({ onSignedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setError('');
    setBusy(true);

    try {
      const profile = await signIn(username, password);
      onSignedIn(profile);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  // Let the person press Enter instead of clicking the button.
  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      handleSignIn();
    }
  }

  return (
    <div className="login-page">
      <div className="box login-box">
        <h1>Mart POS</h1>

        {error && <div className="error">{error}</div>}

        <label>
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </label>

        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </label>

        <button className="primary big" onClick={handleSignIn} disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}
