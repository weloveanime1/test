import { Lock } from 'lucide-react';
import { useState } from 'react';
import { login } from '../lib/auth';
import { Logo } from './Logo';

export function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (await login(password)) return onUnlock();
      setError('Wrong password. Try again.');
      setPassword('');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="gate">
      <form className="gate-card" onSubmit={submit}>
        <Logo size={56} />
        <h1>
          Nepal<i>hub</i>
        </h1>
        <p>This site is private. Enter the access password to continue.</p>
        <label className="gate-input">
          <Lock size={18} />
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            autoComplete="current-password"
            placeholder="Access password"
            aria-label="Access password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy || !password}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </main>
  );
}
