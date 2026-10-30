import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../app/api.js';
import { useAuth } from '../../../app/auth.jsx';
import { watchChatUpdates } from '../../../app/chat-updates.js';
export function SellerLeads() {
  const auth = useAuth();
  const [chats, setChats] = useState([]);
  const [viewings, setViewings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [kind, setKind] = useState('all');
  const [followUp, setFollowUp] = useState('all');
  const [propertyId, setPropertyId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () =>
      Promise.all([api.get('/api/chats'), api.get('/api/viewings'), api.get('/api/property/mine')])
        .then(([chatResponse, viewingResponse, propertyResponse]) => {
          if (!active) return;
          setChats(chatResponse.data.chats);
          setViewings(viewingResponse.data.viewings);
          setProperties(propertyResponse.data.properties);
          setError('');
        })
        .catch((requestError) => {
          if (active)
            setError(requestError.response?.data?.message || 'Could not load seller leads.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    const controller = new AbortController();
    refresh();
    watchChatUpdates(refresh, controller.signal);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const updateViewing = async (viewing, status) => {
    setBusyId(viewing._id);
    setError('');
    setMessage('');
    try {
      const { data } = await api.patch(`/api/viewings/${viewing._id}`, { status });
      setViewings((current) =>
        current.map((item) =>
          item._id === viewing._id
            ? { ...item, status: data.viewing.status, updatedAt: data.viewing.updatedAt }
            : item,
        ),
      );
      setMessage(`Viewing request ${status}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update the viewing request.');
    } finally {
      setBusyId('');
    }
  };

  const leads = [
    ...chats.map((chat) => {
      const lastMessage = chat.messages?.at(-1);
      const needsAction =
        !lastMessage ||
        String(lastMessage.sender?._id || lastMessage.sender) !== String(auth.user._id);
      return {
        id: `chat:${chat._id}`,
        chat,
        type: 'message',
        property: chat.property,
        buyer: chat.buyer,
        createdAt: lastMessage?.sentAt || chat.updatedAt,
        preview: lastMessage?.text || 'Conversation started. Send a welcome message.',
        needsAction,
        statusLabel: needsAction ? 'Needs reply' : 'Conversation',
      };
    }),
    ...viewings.map((viewing) => ({
      id: `viewing:${viewing._id}`,
      viewing,
      type: 'viewing',
      property: viewing.property,
      buyer: viewing.buyer,
      createdAt: viewing.updatedAt || viewing.createdAt,
      preview: `${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(viewing.requestedFor))}${viewing.note ? ` · ${viewing.note}` : ''}`,
      needsAction: viewing.status === 'pending',
      statusLabel: viewing.status === 'pending' ? 'Needs decision' : `Viewing ${viewing.status}`,
    })),
  ]
    .filter((lead) => kind === 'all' || lead.type === kind)
    .filter((lead) => propertyId === 'all' || String(lead.property?._id) === propertyId)
    .filter(
      (lead) =>
        followUp === 'all' || (followUp === 'needs-action' ? lead.needsAction : !lead.needsAction),
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <section className="page-wrap leads-page">
      <div className="page-intro">
        <span className="eyebrow">Buyer activity</span>
        <h1>Seller leads</h1>
        <p>Messages and viewing requests for your listings, together in one place.</p>
      </div>
      <div className="leads-summary">
        <div>
          <span>Conversations</span>
          <b>{chats.length}</b>
        </div>
        <div>
          <span>Pending viewings</span>
          <b>{viewings.filter((item) => item.status === 'pending').length}</b>
        </div>
        <Link className="button button-quiet button-small" to="/messages">
          All messages ↗
        </Link>
      </div>
      <div className="leads-filters">
        <label>
          Listing
          <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
            <option value="all">All listings</option>
            {properties.map((property) => (
              <option key={property._id} value={property._id}>
                {property.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Activity
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">Messages and viewings</option>
            <option value="message">Messages</option>
            <option value="viewing">Viewing requests</option>
          </select>
        </label>
        <label>
          Follow-up
          <select value={followUp} onChange={(event) => setFollowUp(event.target.value)}>
            <option value="all">All activity</option>
            <option value="needs-action">Needs action</option>
            <option value="handled">Handled</option>
          </select>
        </label>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success-banner" role="status">
          {message}
        </p>
      )}
      {loading ? (
        <p className="loading" role="status">
          Gathering buyer activity…
        </p>
      ) : leads.length ? (
        <div className="lead-list">
          {leads.map((lead) => (
            <article className="lead-item" key={lead.id}>
              <span className="lead-avatar" aria-hidden="true">
                {lead.buyer?.name?.charAt(0)?.toUpperCase() || 'B'}
              </span>
              <div className="lead-main">
                <div className="lead-title">
                  <strong>{lead.buyer?.name || 'Buyer'}</strong>
                  <span className={`lead-type lead-${lead.type}`}>
                    {lead.type === 'message' ? 'Message' : 'Viewing'}
                  </span>
                  <span className={`lead-status${lead.needsAction ? ' needs-action' : ''}`}>
                    {lead.statusLabel}
                  </span>
                </div>
                <Link
                  className="lead-property"
                  to={lead.property?._id ? `/properties/${lead.property._id}` : '/dashboard'}
                >
                  {lead.property?.title || 'Property conversation'}
                </Link>
                <p>{lead.preview}</p>
              </div>
              <time dateTime={lead.createdAt}>
                {new Intl.DateTimeFormat(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(lead.createdAt))}
              </time>
              <div className="lead-actions">
                {lead.type === 'message' ? (
                  <Link className="button button-small" to={`/messages/${lead.chat._id}`}>
                    Open conversation
                  </Link>
                ) : lead.viewing.status === 'pending' ? (
                  <>
                    <button
                      className="button button-small"
                      disabled={busyId === lead.viewing._id}
                      onClick={() => updateViewing(lead.viewing, 'accepted')}
                    >
                      Accept
                    </button>
                    <button
                      className="button button-quiet button-small"
                      disabled={busyId === lead.viewing._id}
                      onClick={() => updateViewing(lead.viewing, 'declined')}
                    >
                      Decline
                    </button>
                  </>
                ) : (
                  <Link className="text-link" to="/viewings">
                    View request
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>
            {chats.length || viewings.length
              ? 'No leads match these filters'
              : 'No buyer activity yet'}
          </h2>
          <p>
            {chats.length || viewings.length
              ? 'Try another listing or follow-up filter.'
              : 'Buyer messages and viewing requests will appear here.'}
          </p>
          {(kind !== 'all' || followUp !== 'all' || propertyId !== 'all') && (
            <button
              className="button button-quiet"
              onClick={() => {
                setKind('all');
                setFollowUp('all');
                setPropertyId('all');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </section>
  );
}
