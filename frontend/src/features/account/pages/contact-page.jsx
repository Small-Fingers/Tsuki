import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../../app/api.js';
import { useAuth } from '../../../app/auth.jsx';
export function Contact() {
  const auth = useAuth();
  const [form, setForm] = useState({
    name: auth?.user?.name || '',
    email: auth?.user?.email || '',
    subject: '',
    message: '',
  });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/api/contact', form);
      setSent(true);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not send your message.');
    } finally {
      setBusy(false);
    }
  };
  if (auth?.user?.role === 'admin') return <Navigate to="/admin/contacts" replace />;
  return (
    <section className="page-wrap form-wrap">
      <span className="eyebrow">We’re here to help</span>
      <h1>Contact Tsuki</h1>
      <p className="muted">
        Messages are saved to the team’s contact inbox. An administrator will review and reply
        manually.
      </p>
      {sent ? (
        <div className="success-banner" role="status">
          Thanks for reaching out. Your message is in the team’s contact inbox.
        </div>
      ) : (
        <form className="listing-form" onSubmit={submit}>
          <label>
            Name
            <input
              required
              maxLength="120"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              maxLength="254"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Subject
            <input
              required
              maxLength="160"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </label>
          <label>
            Message
            <textarea
              required
              maxLength="5000"
              rows="6"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </label>
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Send message'}
          </button>
        </form>
      )}
    </section>
  );
}
