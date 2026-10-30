import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../app/api.js';
import { useNotifications } from '../../../app/notifications.jsx';
export function NotificationsPage() {
  const { unreadCount, refreshNotifications } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(
    () =>
      refreshNotifications()
        .then((data) => setNotifications(data.notifications || []))
        .catch((requestError) =>
          setError(requestError.response?.data?.message || 'Could not load notifications.'),
        )
        .finally(() => setLoading(false)),
    [refreshNotifications],
  );
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 45_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const markAllRead = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/api/notifications/read-all');
      await refresh();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not mark notifications as read.');
    } finally {
      setBusy(false);
    }
  };
  const icons = { message: '✉', viewing: '⌂', reminder: '◷', search: '⌕', report: '⚑' };
  return (
    <section className="page-wrap notifications-page">
      <div className="page-intro">
        <span className="eyebrow">Your updates</span>
        <div className="notifications-title-row">
          <div>
            <h1>Notifications</h1>
            <p>
              Messages, viewing updates and reminders, and new homes matching your saved searches.
            </p>
          </div>
          <button
            className="button button-quiet button-small"
            type="button"
            disabled={!unreadCount || busy}
            onClick={markAllRead}
          >
            {busy ? 'Marking read…' : 'Mark all as read'}
          </button>
        </div>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="loading" role="status">
          Checking your updates…
        </p>
      ) : notifications.length ? (
        <div className="notification-list">
          {notifications.map((notification) => (
            <Link
              className={`notification-item${notification.unread ? ' is-unread' : ''}`}
              key={notification.id}
              to={notification.href}
            >
              <span
                className={`notification-icon notification-${notification.type}`}
                aria-hidden="true"
              >
                {icons[notification.type] || '•'}
              </span>
              <span className="notification-copy">
                <strong>{notification.title}</strong>
                <span>{notification.body}</span>
              </span>
              <time dateTime={notification.createdAt}>
                {new Intl.DateTimeFormat(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(notification.createdAt))}
              </time>
              {notification.unread && (
                <span className="notification-unread-dot" aria-label="Unread" />
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>You’re all caught up</h2>
          <p>New messages, viewing updates, reminders, and search matches will appear here.</p>
        </div>
      )}
    </section>
  );
}
