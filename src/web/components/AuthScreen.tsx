import { useState, type FormEvent } from 'react';
import { IconLock, IconArrowRight } from '@tabler/icons-react';
import { api, send, setCsrf } from '../api';
import { ErrorMessage, Field } from './common';
export function AuthScreen({
  configured,
  demo,
  onLogin,
}: {
  configured: boolean;
  demo: boolean;
  onLogin: () => void;
}) {
  const [username, setUsername] = useState(demo ? 'demo' : '');
  const [password, setPassword] = useState(demo ? 'cabivue-demo-only' : '');
  const [secret, setSecret] = useState('');
  const [setup, setSetup] = useState(!configured);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (setup) {
        await api('/auth/bootstrap', send('POST', { username, password, secret }));
        setSetup(false);
        setSecret('');
      }
      const r = await api<{ csrf: string }>('/auth/login', send('POST', { username, password }));
      setPassword('');
      setCsrf(r.csrf);
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <img src="/brand/cabivue-logo.svg" className="logo" alt="Cabivue" />
        <div>
          <p className="eyebrow">Your household, organized</p>
          <h1>
            Know what
            <br />
            you have.
          </h1>
          <p>
            A clearer view of your medicine cabinet.
            <br />
            One pack, one date, one less thing to remember.
          </p>
        </div>
        <p className="muted">Self-hosted. Private to your household.</p>
      </section>
      <section className="auth-form card">
        <span className="section-icon">
          <IconLock size={26} />
        </span>
        <h2>{setup ? 'Set up your cabinet' : 'Welcome home'}</h2>
        <p className="muted">
          {setup
            ? 'Create the one household administrator account.'
            : 'Sign in to see your medicines and upcoming dates.'}
        </p>
        {demo && (
          <div className="alert alert-info">
            Synthetic demo only. No real medicines or provider calls.
          </div>
        )}
        <form onSubmit={submit}>
          <ErrorMessage error={error} />
          {setup && (
            <Field
              label="One-time setup secret"
              hint="Read the secret file created during installation."
            >
              <input
                className="input"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                required
                autoComplete="off"
              />
            </Field>
          )}
          <Field label="Username">
            <input
              className="input"
              value={username}
              minLength={3}
              maxLength={60}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>
          <Field label="Password" hint={setup ? 'At least 12 characters.' : undefined}>
            <input
              className="input"
              type="password"
              value={password}
              minLength={12}
              maxLength={256}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={setup ? 'new-password' : 'current-password'}
              required
            />
          </Field>
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Working…' : setup ? 'Create household' : 'Sign in'}
            <IconArrowRight size={20} />
          </button>
        </form>
        <p className="small muted">Your cabinet works without an AI key.</p>
      </section>
    </main>
  );
}
