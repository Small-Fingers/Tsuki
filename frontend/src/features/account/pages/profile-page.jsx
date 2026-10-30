import { useState } from 'react';

import { api } from '../../../app/api.js';
import { useAuth } from '../../../app/auth.jsx';
export function Profile() {
  const auth = useAuth();
  const [form, setForm] = useState({
    name: auth.user.name || '',
    phone: auth.user.phone || '',
    address: auth.user.address || '',
    profilePic: auth.user.profilePic || '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.patch('/api/auth/me', form);
      auth.setAuth({ ...auth, user: data.user });
      setMessage('Your profile has been updated.');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not update profile.');
    } finally {
      setBusy(false);
    }
  };
  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordBusy(true);
    setPasswordError('');
    setPasswordMessage('');
    try {
      const { data } = await api.patch('/api/auth/password', passwordForm);
      auth.setAuth({ token: data.token, user: data.user });
      setPasswordMessage(data.message);
      setPasswordForm({ currentPassword: '', newPassword: '' });
    } catch (e) {
      setPasswordError(e.response?.data?.message || 'Could not update password.');
    } finally {
      setPasswordBusy(false);
    }
  };
  return (
    <section className="page-wrap form-wrap">
      <span className="eyebrow">Your account</span>
      <h1>Profile</h1>
      <p className="muted">
        {auth.user.mustChangePassword
          ? 'Set your new password before updating your profile or using account features.'
          : 'Update the contact details shown on your account.'}
      </p>
      {auth.user.mustChangePassword && (
        <p className="error-banner" role="alert">
          An administrator reset your password. Set a new password below before using your account.
        </p>
      )}
      <form className="listing-form" onSubmit={auth.user.mustChangePassword ? undefined : submit}>
        <label>
          Name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={auth.user.mustChangePassword}
          />
        </label>
        <label>
          Email
          <input value={auth.user.email} disabled />
        </label>
        <label>
          Phone
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            disabled={auth.user.mustChangePassword}
          />
        </label>
        <label>
          Address
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            disabled={auth.user.mustChangePassword}
          />
        </label>
        <label>
          Profile image URL
          <input
            type="url"
            value={form.profilePic}
            onChange={(e) => setForm({ ...form, profilePic: e.target.value })}
            disabled={auth.user.mustChangePassword}
          />
        </label>
        {message && (
          <p className="success-banner" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy || auth.user.mustChangePassword}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
      <h2>Change password</h2>
      <p className="muted">Use your current password to choose a new one.</p>
      <form className="listing-form" onSubmit={changePassword}>
        <label>
          Current password
          <input
            required
            type="password"
            autoComplete="current-password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
          />
        </label>
        <label>
          New password
          <input
            required
            minLength="8"
            type="password"
            autoComplete="new-password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
          />
        </label>
        {passwordMessage && (
          <p className="success-banner" role="status">
            {passwordMessage}
          </p>
        )}
        {passwordError && (
          <p className="error-banner" role="alert">
            {passwordError}
          </p>
        )}
        <button className="button" disabled={passwordBusy}>
          {passwordBusy ? 'Updating…' : 'Change password'}
        </button>
      </form>
    </section>
  );
}
