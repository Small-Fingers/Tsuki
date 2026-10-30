import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../../app/api.js';
import { useAuth } from '../../../app/auth.jsx';
export function Account({ register = false }) {
  const auth = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'buyer' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (auth?.user)
    return (
      <Navigate
        to={
          auth.user.role === 'admin'
            ? '/admin'
            : register && auth.user.role === 'seller'
              ? '/new-listing'
              : auth.user.role === 'seller'
                ? '/dashboard'
                : '/properties'
        }
      />
    );
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      let data;
      if (register) {
        ({ data } = await api.post('/api/auth/register', form));
      } else {
        ({ data } = await api.post('/api/auth/login', form));
      }
      auth.setAuth(data);
      nav(
        data.user.role === 'admin'
          ? '/admin'
          : data.user.role === 'seller'
            ? '/dashboard'
            : '/properties',
      );
    } catch (e) {
      setError(e.response?.data?.message || 'Could not connect to the server');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="account-page">
      <div className="account-orbit" aria-hidden="true">
        <span className="account-orbit-moon">
          <svg viewBox="0 0 24 24">
            <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.463.402.807a6.5 6.5 0 0 0 8.268 8.268c.344-.215.829-.003.803.397z" />
          </svg>
        </span>
      </div>
      <form className="account-card" onSubmit={submit}>
        <span className="eyebrow">Welcome to Tsuki</span>
        <h1>{register ? 'Find your place.' : 'Good to see you.'}</h1>
        <p className="muted">
          {register
            ? 'Create an account to get started. You can sign in as soon as it’s created.'
            : 'Sign in to continue your search.'}
        </p>
        {register && (
          <label>
            Your name
            <input
              required
              maxLength="120"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
        )}
        <label>
          Email address
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          Password
          <input
            required
            minLength="8"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        {register && (
          <label>
            I am here as
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="buyer">Looking for a home</option>
              <option value="seller">Listing a home</option>
            </select>
          </label>
        )}
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <button className="button full-button" disabled={busy}>
          {busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
        </button>
        <p className="muted account-switch">
          {register ? 'Already have an account?' : 'New to Tsuki?'}{' '}
          <Link to={register ? '/login' : '/register'}>
            {register ? 'Log in' : 'Create an account'}
          </Link>
        </p>
      </form>
    </section>
  );
}
