import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../app/api.js';
import { useAuth } from '../../../app/auth.jsx';
import { watchChatUpdates } from '../../../app/chat-updates.js';
export function MessagesInbox() {
  const auth = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () =>
      api
        .get('/api/chats')
        .then(({ data }) => {
          if (active) setChats(data.chats);
        })
        .catch((e) => {
          if (active) setError(e.response?.data?.message || 'Could not load conversations');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    const controller = new AbortController();
    refresh();
    watchChatUpdates(refresh, controller.signal);
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  return (
    <section className="page-wrap inbox-wrap">
      <div className="page-intro">
        <span className="eyebrow">Your conversations</span>
        <h1>Messages</h1>
        <p>Continue a conversation about a property.</p>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="loading" role="status">
          Loading conversations…
        </p>
      ) : chats.length ? (
        <div className="inbox-list">
          {chats.map((chat) => {
            const partner =
              String(chat.buyer?._id) === String(auth.user._id) ? chat.seller : chat.buyer;
            const lastMessage = chat.messages?.at(-1);
            const unread = (chat.messages || []).filter(
              (message) =>
                String(message.sender?._id || message.sender) !== String(auth.user._id) &&
                !message.readAt,
            ).length;
            return (
              <Link className="inbox-item" key={chat._id} to={`/messages/${chat._id}`}>
                <span className="inbox-avatar" aria-hidden="true">
                  {partner?.name?.charAt(0)?.toUpperCase() || 'H'}
                </span>
                <span className="inbox-main">
                  <strong>{partner?.name || 'Home owner'}</strong>
                  <span>{chat.property?.title || 'Property conversation'}</span>
                  <small>
                    {unread > 0 && <b className="unread-count">{unread} unread · </b>}
                    {lastMessage?.text || 'No messages yet'}
                  </small>
                </span>
                <time dateTime={chat.updatedAt}>
                  {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
                    new Date(chat.updatedAt),
                  )}
                </time>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No conversations yet</h2>
          <p>When you contact a seller, your conversations will appear here.</p>
          <Link className="button" to="/properties">
            Explore homes
          </Link>
        </div>
      )}
    </section>
  );
}
