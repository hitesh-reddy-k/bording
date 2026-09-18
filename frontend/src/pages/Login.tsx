import { useState } from 'react';
import { useApp } from '../lib/context';
import { api } from '../lib/api';
import { addToast } from '../lib/toast';

export function Login() {
  const { login } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let result: any;
      if (mode === 'login') {
        result = await api.login({ email: form.email, password: form.password });
      } else {
        result = await api.register(form);
      }
      login(result.token, result.user);
      addToast(`Welcome${mode === 'register' ? ' to PacificBoard' : ' back'}, ${result.user.name}!`, 'success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 20%, rgba(34,211,238,0.06), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.06), transparent 50%), var(--bg)',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        pointerEvents: 'none',
      }} />

      <div style={{ width: 'min(420px, 95vw)', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, var(--cyan), var(--blue))',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: '1.5rem', fontWeight: 900, color: '#030712',
            boxShadow: '0 8px 30px rgba(34,211,238,0.3)',
          }}>P</div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>PacificBoard</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>
            Real-time collaborative workspace
          </p>
        </div>

        {/* Card */}
        <div className="card-glass" style={{ padding: '2rem' }}>
          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: '1.5rem' }}>
            <div className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>
              Sign In
            </div>
            <div className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>
              Create Account
            </div>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {mode === 'register' && (
              <div>
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
            )}
            <div>
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius)',
                padding: '0.625rem 0.875rem',
                fontSize: '0.8rem',
                color: 'var(--red)',
              }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? (
                <><span className="spinner" style={{ width: 16, height: 16 }} /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: '0.75rem', color: 'var(--text-3)' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.375rem', color: 'var(--text-2)' }}>Quick Demo</div>
            <div>Try: <strong>demo@pacific.io</strong> / <strong>password123</strong></div>
            <div style={{ marginTop: '0.25rem' }}>Or create a new account to get started.</div>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.72rem', color: 'var(--text-4)' }}>
          Powered by <strong style={{ color: 'var(--cyan)' }}>PacificDB</strong> — RF3 replication · Vector search · Media storage
        </p>
      </div>
    </div>
  );
}
