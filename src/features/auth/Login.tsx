import { useState, type FormEvent } from 'react';
import { API_URL } from '../../lib/api';
import { useAuth } from './auth';
import { TextField } from '../../components/forms';
import { useAction } from '../../lib/hooks';
import { ErrorBox } from '../../components/feedback';
import { useTheme } from '../../lib/theme';
import { FiMoon, FiSun } from 'react-icons/fi';

export default function Login() {
  const { signIn } = useAuth();
  const { theme, toggle } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { run, busy, error } = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => signIn(email, password));
  };

  return (
    <div className="login">
      <div className="login-art">
        <img src="/logo.png" alt="" />
        <h2 className="tagline">Unforgettable supercar experiences</h2>
        <p>Manage the fleet, bookings, drivers and payments from one place.</p>
      </div>
      <form className="login-panel" onSubmit={submit} noValidate>
        <div className="row between">
          <img src="/wordmark.png" alt="Supercarstars.com" style={{ width: 220 }} className="login-wordmark" />
          <button type="button" className="icon-btn" onClick={toggle} aria-label="Toggle theme">{theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}</button>
        </div>
        <div>
          <h1>Sign in</h1>
          <p className="dim" style={{ margin: '6px 0 0' }}>Company staff only.</p>
        </div>
        <TextField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" />
        <TextField label="Password" type="password" value={password} onChange={setPassword} />
        <ErrorBox error={error} />
        <button className="btn gold" type="submit" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="muted small" style={{ margin: 0 }}>API: {API_URL}</p>
      </form>
    </div>
  );
}
