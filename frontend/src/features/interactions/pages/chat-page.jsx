import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../app/api.js';
import { useAuth } from '../../../app/auth.jsx';
import { watchChatUpdates } from '../../../app/chat-updates.js';
export function ChatPage() {
  const { id } = useParams();
  const auth = useAuth();
  const [chat, setChat] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const { data } = await api.get(`/api/chats/${id}`);
        if (active) {
          setChat(data.chat);
          setError('');
          await api.post(`/api/chats/${id}/read`);
        }
      } catch (e) {
        if (active) setError(e.response?.data?.message || 'Could not load conversation');
      }
    };
    const controller = new AbortController();
    refresh();
    watchChatUpdates((event) => {
      if (event.chatId === id) refresh();
    }, controller.signal);
    const timer = setInterval(refresh, 20000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [id]);
  const send = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/api/chats/${id}/messages`, { text });
      setChat(data.chat);
      setText('');
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };
  if (error && !chat)
    return (
      <section className="page-wrap">
        <p className="error-banner">{error}</p>
        <Link to="/properties">Back to homes</Link>
      </section>
    );
  if (!chat) return <p className="loading">Opening conversation…</p>;
  const partner =
    String(chat.buyer?._id || chat.buyer) === String(auth.user._id) ? chat.seller : chat.buyer;
  return (
    <section className="page-wrap chat-wrap">
      <Link className="text-link" to="/properties">
        ← Browse homes
      </Link>
      <div className="chat-panel">
        <div className="chat-title">
          <span className="eyebrow">Private conversation · updates automatically</span>
          <h1>{partner?.name || 'Home owner'}</h1>
          {chat.property?.title && <p className="muted">Regarding {chat.property.title}</p>}
        </div>
        <div className="chat-messages">
          {chat.messages.length ? (
            chat.messages.map((message, index) => {
              const own = String(message.sender?._id || message.sender) === String(auth.user._id);
              return (
                <div
                  className={`chat-message ${own ? 'message-own' : ''}`}
                  key={message._id || index}
                >
                  <span>
                    {own ? 'You' : partner?.name || 'Home owner'}
                    {own && message.readAt ? ' · Read' : ''}
                  </span>
                  <p>{message.text}</p>
                </div>
              );
            })
          ) : (
            <p className="chat-empty">Start the conversation with a message about this property.</p>
          )}
        </div>
        {error && <p className="error-banner">{error}</p>}
        <form className="chat-compose" onSubmit={send}>
          <label className="sr-only" htmlFor="chat-message">
            Your message
          </label>
          <input
            id="chat-message"
            maxLength="4000"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
          />
          <button className="button" disabled={sending || !text.trim()}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  );
}
