import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import heroImage from '../assets/hero-apartment.jpg';
import { api, PROPERTY_COLLECTIONS, useAuth, usePropertyTools, useNotifications, money, localDateKey, availabilityInfo, availabilityLabel, watchChatUpdates, usePrefersReducedMotion } from '../app/shared.jsx';

export function ChatPage() {
  const { id } = useParams(); const auth = useAuth(); const [chat, setChat] = useState(null); const [text, setText] = useState(''); const [error, setError] = useState(''); const [sending, setSending] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const { data } = await api.get(`/api/chats/${id}`); if (active) { setChat(data.chat); setError(''); await api.post(`/api/chats/${id}/read`); } }
      catch (e) { if (active) setError(e.response?.data?.message || 'Could not load conversation'); }
    };
    const controller = new AbortController();
    refresh();
    watchChatUpdates((event) => { if (event.chatId === id) refresh(); }, controller.signal);
    const timer = setInterval(refresh, 20000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, [id]);
  const send = async (event) => { event.preventDefault(); if (!text.trim()) return; setSending(true); try { const { data } = await api.post(`/api/chats/${id}/messages`, { text }); setChat(data.chat); setText(''); setError(''); } catch (e) { setError(e.response?.data?.message || 'Could not send message'); } finally { setSending(false); } };
  if (error && !chat) return <section className="page-wrap"><p className="error-banner">{error}</p><Link to="/properties">Back to homes</Link></section>;
  if (!chat) return <p className="loading">Opening conversation…</p>;
  const partner = String(chat.buyer?._id || chat.buyer) === String(auth.user._id) ? chat.seller : chat.buyer;
  return <section className="page-wrap chat-wrap"><Link className="text-link" to="/properties">← Browse homes</Link><div className="chat-panel"><div className="chat-title"><span className="eyebrow">Private conversation · updates automatically</span><h1>{partner?.name || 'Home owner'}</h1>{chat.property?.title && <p className="muted">Regarding {chat.property.title}</p>}</div><div className="chat-messages">{chat.messages.length ? chat.messages.map((message, index) => { const own = String(message.sender?._id || message.sender) === String(auth.user._id); return <div className={`chat-message ${own ? 'message-own' : ''}`} key={message._id || index}><span>{own ? 'You' : partner?.name || 'Home owner'}{own && message.readAt ? ' · Read' : ''}</span><p>{message.text}</p></div>; }) : <p className="chat-empty">Start the conversation with a message about this property.</p>}</div>{error && <p className="error-banner">{error}</p>}<form className="chat-compose" onSubmit={send}><label className="sr-only" htmlFor="chat-message">Your message</label><input id="chat-message" maxLength="4000" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…"/><button className="button" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send'}</button></form></div></section>;
}
export function MessagesInbox() {
  const auth = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => api.get('/api/chats').then(({ data }) => { if (active) setChats(data.chats); }).catch((e) => { if (active) setError(e.response?.data?.message || 'Could not load conversations'); }).finally(() => { if (active) setLoading(false); });
    const controller = new AbortController();
    refresh();
    watchChatUpdates(refresh, controller.signal);
    const timer = setInterval(refresh, 30000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, []);
  return <section className="page-wrap inbox-wrap"><div className="page-intro"><span className="eyebrow">Your conversations</span><h1>Messages</h1><p>Continue a conversation about a property.</p></div>{error && <p className="error-banner" role="alert">{error}</p>}{loading ? <p className="loading" role="status">Loading conversations…</p> : chats.length ? <div className="inbox-list">{chats.map((chat) => { const partner = String(chat.buyer?._id) === String(auth.user._id) ? chat.seller : chat.buyer; const lastMessage = chat.messages?.at(-1); const unread = (chat.messages || []).filter((message) => String(message.sender?._id || message.sender) !== String(auth.user._id) && !message.readAt).length; return <Link className="inbox-item" key={chat._id} to={`/messages/${chat._id}`}><span className="inbox-avatar" aria-hidden="true">{partner?.name?.charAt(0)?.toUpperCase() || 'H'}</span><span className="inbox-main"><strong>{partner?.name || 'Home owner'}</strong><span>{chat.property?.title || 'Property conversation'}</span><small>{unread > 0 && <b className="unread-count">{unread} unread · </b>}{lastMessage?.text || 'No messages yet'}</small></span><time dateTime={chat.updatedAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(chat.updatedAt))}</time></Link>; })}</div> : <div className="empty-state"><h2>No conversations yet</h2><p>When you contact a seller, your conversations will appear here.</p><Link className="button" to="/properties">Explore homes</Link></div>}</section>;
}

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
    const refresh = () => Promise.all([api.get('/api/chats'), api.get('/api/viewings'), api.get('/api/property/mine')])
      .then(([chatResponse, viewingResponse, propertyResponse]) => {
        if (!active) return;
        setChats(chatResponse.data.chats);
        setViewings(viewingResponse.data.viewings);
        setProperties(propertyResponse.data.properties);
        setError('');
      })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load seller leads.'); })
      .finally(() => { if (active) setLoading(false); });
    const controller = new AbortController();
    refresh();
    watchChatUpdates(refresh, controller.signal);
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, []);

  const updateViewing = async (viewing, status) => {
    setBusyId(viewing._id); setError(''); setMessage('');
    try {
      const { data } = await api.patch(`/api/viewings/${viewing._id}`, { status });
      setViewings((current) => current.map((item) => item._id === viewing._id ? { ...item, status: data.viewing.status, updatedAt: data.viewing.updatedAt } : item));
      setMessage(`Viewing request ${status}.`);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not update the viewing request.'); }
    finally { setBusyId(''); }
  };

  const leads = [
    ...chats.map((chat) => {
      const lastMessage = chat.messages?.at(-1);
      const needsAction = !lastMessage || String(lastMessage.sender?._id || lastMessage.sender) !== String(auth.user._id);
      return { id: `chat:${chat._id}`, chat, type: 'message', property: chat.property, buyer: chat.buyer, createdAt: lastMessage?.sentAt || chat.updatedAt, preview: lastMessage?.text || 'Conversation started. Send a welcome message.', needsAction, statusLabel: needsAction ? 'Needs reply' : 'Conversation' };
    }),
    ...viewings.map((viewing) => ({
      id: `viewing:${viewing._id}`, viewing, type: 'viewing', property: viewing.property, buyer: viewing.buyer,
      createdAt: viewing.updatedAt || viewing.createdAt,
      preview: `${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(viewing.requestedFor))}${viewing.note ? ` · ${viewing.note}` : ''}`,
      needsAction: viewing.status === 'pending', statusLabel: viewing.status === 'pending' ? 'Needs decision' : `Viewing ${viewing.status}`,
    })),
  ].filter((lead) => kind === 'all' || lead.type === kind)
    .filter((lead) => propertyId === 'all' || String(lead.property?._id) === propertyId)
    .filter((lead) => followUp === 'all' || (followUp === 'needs-action' ? lead.needsAction : !lead.needsAction))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return <section className="page-wrap leads-page">
    <div className="page-intro"><span className="eyebrow">Buyer activity</span><h1>Seller leads</h1><p>Messages and viewing requests for your listings, together in one place.</p></div>
    <div className="leads-summary"><div><span>Conversations</span><b>{chats.length}</b></div><div><span>Pending viewings</span><b>{viewings.filter((item) => item.status === 'pending').length}</b></div><Link className="button button-quiet button-small" to="/messages">All messages ↗</Link></div>
    <div className="leads-filters">
      <label>Listing<select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="all">All listings</option>{properties.map((property) => <option key={property._id} value={property._id}>{property.title}</option>)}</select></label>
      <label>Activity<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Messages and viewings</option><option value="message">Messages</option><option value="viewing">Viewing requests</option></select></label>
      <label>Follow-up<select value={followUp} onChange={(event) => setFollowUp(event.target.value)}><option value="all">All activity</option><option value="needs-action">Needs action</option><option value="handled">Handled</option></select></label>
    </div>
    {error && <p className="error-banner" role="alert">{error}</p>}{message && <p className="success-banner" role="status">{message}</p>}
    {loading ? <p className="loading" role="status">Gathering buyer activity…</p> : leads.length ? <div className="lead-list">{leads.map((lead) => <article className="lead-item" key={lead.id}>
      <span className="lead-avatar" aria-hidden="true">{lead.buyer?.name?.charAt(0)?.toUpperCase() || 'B'}</span>
      <div className="lead-main"><div className="lead-title"><strong>{lead.buyer?.name || 'Buyer'}</strong><span className={`lead-type lead-${lead.type}`}>{lead.type === 'message' ? 'Message' : 'Viewing'}</span><span className={`lead-status${lead.needsAction ? ' needs-action' : ''}`}>{lead.statusLabel}</span></div><Link className="lead-property" to={lead.property?._id ? `/properties/${lead.property._id}` : '/dashboard'}>{lead.property?.title || 'Property conversation'}</Link><p>{lead.preview}</p></div>
      <time dateTime={lead.createdAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(lead.createdAt))}</time>
      <div className="lead-actions">{lead.type === 'message' ? <Link className="button button-small" to={`/messages/${lead.chat._id}`}>Open conversation</Link> : lead.viewing.status === 'pending' ? <><button className="button button-small" disabled={busyId === lead.viewing._id} onClick={() => updateViewing(lead.viewing, 'accepted')}>Accept</button><button className="button button-quiet button-small" disabled={busyId === lead.viewing._id} onClick={() => updateViewing(lead.viewing, 'declined')}>Decline</button></> : <Link className="text-link" to="/viewings">View request</Link>}</div>
    </article>)}</div> : <div className="empty-state"><h2>{chats.length || viewings.length ? 'No leads match these filters' : 'No buyer activity yet'}</h2><p>{chats.length || viewings.length ? 'Try another listing or follow-up filter.' : 'Buyer messages and viewing requests will appear here.'}</p>{(kind !== 'all' || followUp !== 'all' || propertyId !== 'all') && <button className="button button-quiet" onClick={() => { setKind('all'); setFollowUp('all'); setPropertyId('all'); }}>Clear filters</button>}</div>}
  </section>;
}

export function NotificationsPage() {
  const { unreadCount, refreshNotifications } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = () => refreshNotifications().then((data) => setNotifications(data.notifications || [])).catch((requestError) => setError(requestError.response?.data?.message || 'Could not load notifications.')).finally(() => setLoading(false));
  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 45_000); return () => window.clearInterval(timer); }, []);
  const markAllRead = async () => {
    setBusy(true); setError('');
    try { await api.post('/api/notifications/read-all'); await refresh(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not mark notifications as read.'); }
    finally { setBusy(false); }
  };
  const icons = { message: '✉', viewing: '⌂', reminder: '◷', search: '⌕', report: '⚑' };
  return <section className="page-wrap notifications-page">
    <div className="page-intro"><span className="eyebrow">Your updates</span><div className="notifications-title-row"><div><h1>Notifications</h1><p>Messages, viewing updates and reminders, and new homes matching your saved searches.</p></div><button className="button button-quiet button-small" type="button" disabled={!unreadCount || busy} onClick={markAllRead}>{busy ? 'Marking read…' : 'Mark all as read'}</button></div></div>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {loading ? <p className="loading" role="status">Checking your updates…</p> : notifications.length ? <div className="notification-list">{notifications.map((notification) => <Link className={`notification-item${notification.unread ? ' is-unread' : ''}`} key={notification.id} to={notification.href}>
      <span className={`notification-icon notification-${notification.type}`} aria-hidden="true">{icons[notification.type] || '•'}</span>
      <span className="notification-copy"><strong>{notification.title}</strong><span>{notification.body}</span></span>
      <time dateTime={notification.createdAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(notification.createdAt))}</time>
      {notification.unread && <span className="notification-unread-dot" aria-label="Unread"/>}
    </Link>)}</div> : <div className="empty-state"><h2>You’re all caught up</h2><p>New messages, viewing updates, reminders, and search matches will appear here.</p></div>}
  </section>;
}

export function ViewingsPage() {
  const auth = useAuth();
  const [viewings, setViewings] = useState([]);
  const [slots, setSlots] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [slotDate, setSlotDate] = useState('');
  const [slotTime, setSlotTime] = useState('');
  const [slotMessage, setSlotMessage] = useState('');
  const [selectedDay, setSelectedDay] = useState(() => localDateKey(new Date()));
  const refresh = () => {
    const requests = [api.get('/api/viewings')];
    if (auth.user.role === 'seller') requests.push(api.get('/api/viewings/availability/mine'), api.get('/api/property/mine'));
    Promise.all(requests).then(([viewingResponse, slotResponse, propertyResponse]) => {
      setViewings(viewingResponse.data.viewings);
      if (slotResponse) setSlots(slotResponse.data.slots);
      if (propertyResponse) {
        const availableListings = propertyResponse.data.properties.filter((property) => property.purpose !== 'rent' && property.status === 'sale');
        setListings(availableListings);
        setSelectedProperty((current) => current || availableListings[0]?._id || '');
      }
      setError('');
    }).catch((requestError) => setError(requestError.response?.data?.message || 'Could not load viewing requests.')).finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const calendarDays = Array.from({ length: 14 }, (_, index) => { const day = new Date(today); day.setDate(day.getDate() + index); return day; });
  const dayKey = localDateKey;
  const dayEvents = [
    ...slots.filter((slot) => slot.status === 'available').map((slot) => ({ type: 'slot', startsAt: slot.startsAt, slot })),
    ...viewings.filter((viewing) => ['pending', 'accepted'].includes(viewing.status)).map((viewing) => ({ type: 'viewing', startsAt: viewing.requestedFor, viewing })),
  ].filter((event) => dayKey(event.startsAt) === selectedDay).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const eventCount = (day) => dayEventsFor(dayKey(day)).length;
  const dayEventsFor = (key) => [...slots.filter((slot) => slot.status === 'available' && dayKey(slot.startsAt) === key), ...viewings.filter((viewing) => ['pending', 'accepted'].includes(viewing.status) && dayKey(viewing.requestedFor) === key)];
  const addSlot = async (event) => {
    event.preventDefault(); setSlotMessage(''); setError('');
    try {
      const startsAt = new Date(`${slotDate}T${slotTime}`);
      const { data } = await api.post('/api/viewings/availability', { propertyId: selectedProperty, startsAt: startsAt.toISOString() });
      setSlotMessage('Viewing time added to your calendar.'); setSelectedDay(dayKey(data.slot.startsAt)); setSlotTime(''); refresh();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not add this viewing time.'); }
  };
  const removeSlot = async (slot) => {
    try { await api.delete(`/api/viewings/availability/${slot._id}`); setSlots((current) => current.filter((item) => item._id !== slot._id)); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not remove this time.'); }
  };
  const update = async (viewing, status) => {
    setBusyId(viewing._id); setError('');
    try { const { data } = await api.patch(`/api/viewings/${viewing._id}`, { status }); setViewings((current) => current.map((item) => item._id === viewing._id ? { ...item, ...data.viewing, property: item.property, buyer: item.buyer, seller: item.seller } : item)); if (auth.user.role === 'seller') refresh(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not update this request.'); }
    finally { setBusyId(''); }
  };
  const downloadCalendarEvent = async (viewing) => {
    setBusyId(viewing._id); setError('');
    try {
      const { data } = await api.get(`/api/viewings/${viewing._id}/calendar`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `tsuki-viewing-${localDateKey(viewing.requestedFor)}.ics`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not create a calendar event.'); }
    finally { setBusyId(''); }
  };
  const requestList = viewings.length ? <div className="viewing-list">{viewings.map((viewing) => { const other = auth.user.role === 'seller' ? viewing.buyer : viewing.seller; return <article className="viewing-item" key={viewing._id}><div className="viewing-thumb">{viewing.property?.images?.[0] && <img src={viewing.property.images[0]} alt=""/>}</div><div className="viewing-info"><Link to={`/properties/${viewing.property?._id}`}><strong>{viewing.property?.title || 'Listing unavailable'}</strong></Link><span>{viewing.property?.area}, {viewing.property?.city} · {money(viewing.property?.price || 0)}{viewing.property?.purpose === 'rent' ? ' / month' : ''}</span><span>{auth.user.role === 'seller' ? 'Requested by' : 'Seller'}: {other?.name || 'Tsuki member'}{other?.phone ? ` · ${other.phone}` : ''}</span>{viewing.note && <p>{viewing.note}</p>}</div><div className="viewing-actions"><time dateTime={viewing.requestedFor}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(viewing.requestedFor))}</time><span className={`viewing-status viewing-${viewing.status}`}>{viewing.status}</span>{viewing.status === 'accepted' && <button className="button button-quiet button-small" disabled={busyId === viewing._id} onClick={() => downloadCalendarEvent(viewing)}>Add to calendar</button>}{auth.user.role === 'seller' && viewing.status === 'pending' && <div><button className="button button-small" disabled={busyId === viewing._id} onClick={() => update(viewing, 'accepted')}>Accept</button><button className="button button-quiet button-small" disabled={busyId === viewing._id} onClick={() => update(viewing, 'declined')}>Decline</button></div>}{auth.user.role === 'buyer' && ['pending', 'accepted'].includes(viewing.status) && <div><button className="button button-quiet button-small" disabled={busyId === viewing._id} onClick={() => update(viewing, 'cancelled')}>Cancel viewing</button></div>}</div></article>; })}</div> : <div className="empty-state"><h2>No viewing requests yet</h2><p>{auth.user.role === 'seller' ? 'Buyer requests will appear here.' : 'Request a visit from a property page to get started.'}</p><Link className="button" to="/properties">Explore homes</Link></div>;
  return <section className="page-wrap viewings-page"><div className="page-intro"><span className="eyebrow">Property visits</span><h1>{auth.user.role === 'seller' ? 'Viewing calendar' : 'Viewing requests'}</h1><p>{auth.user.role === 'seller' ? 'Set open times for buyers and manage confirmed visits.' : 'Track your requested property viewings.'}</p></div>{error && <p className="error-banner" role="alert">{error}</p>}{loading ? <p className="loading" role="status">Loading viewing requests…</p> : <>
    {auth.user.role === 'seller' && <>
      <section className="slot-manager"><div className="slot-manager-heading"><div><span className="eyebrow">Seller availability</span><h2>Add an open time</h2><p>Slots are 30 minutes and become unavailable when a buyer requests them.</p></div></div>{slotMessage && <p className="success-banner" role="status">{slotMessage}</p>}{listings.length ? <form className="slot-create-form" onSubmit={addSlot}><label>Listing<select value={selectedProperty} onChange={(event) => setSelectedProperty(event.target.value)} required>{listings.map((property) => <option key={property._id} value={property._id}>{property.title}</option>)}</select></label><label>Date<input type="date" required min={localDateKey(today)} max={localDateKey(calendarDays[13])} value={slotDate} onChange={(event) => setSlotDate(event.target.value)} /></label><label>Start time<select required value={slotTime} onChange={(event) => setSlotTime(event.target.value)}><option value="">Choose a time</option>{Array.from({ length: 24 }, (_, index) => { const hour = Math.floor(index / 2) + 8; const minute = index % 2 ? '30' : '00'; const value = `${String(hour).padStart(2, '0')}:${minute}`; return <option key={value} value={value}>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(`2000-01-01T${value}:00`))}</option>; })}</select></label><button className="button" disabled={!selectedProperty || !slotDate || !slotTime}>Add to calendar</button></form> : <p className="muted">Create an available sale listing before adding viewing times.</p>}</section>
      <div className="viewing-calendar"><div className="calendar-heading"><h2>Next 14 days</h2><span>Local time</span></div><div className="calendar-days" role="group" aria-label="Choose a day"><div className="calendar-day-scroll">{calendarDays.map((day) => { const key = dayKey(day); return <button type="button" key={key} className={`calendar-day${selectedDay === key ? ' selected' : ''}`} aria-pressed={selectedDay === key} onClick={() => setSelectedDay(key)}><span>{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong><small>{eventCount(day)} {eventCount(day) === 1 ? 'event' : 'events'}</small></button>; })}</div></div><div className="calendar-agenda"><h3>{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${selectedDay}T12:00:00`))}</h3>{dayEvents.length ? <div className="calendar-events">{dayEvents.map((event) => event.type === 'slot' ? <article className="calendar-event calendar-open-slot" key={event.slot._id}><time>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(event.startsAt))}</time><div><strong>Open viewing time</strong><span>{event.slot.property?.title || 'Your listing'}</span></div><span className="viewing-status">Available</span><button className="button button-quiet button-small" onClick={() => removeSlot(event.slot)}>Remove</button></article> : <article className="calendar-event calendar-booked-slot" key={event.viewing._id}><time>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(event.startsAt))}</time><div><strong>{event.viewing.property?.title || 'Listing unavailable'}</strong><span>{event.viewing.status === 'pending' ? `Requested by ${event.viewing.buyer?.name || 'a buyer'}` : `${event.viewing.status[0].toUpperCase()}${event.viewing.status.slice(1)} · ${event.viewing.buyer?.name || 'Buyer'}`}</span></div><span className={`viewing-status viewing-${event.viewing.status}`}>{event.viewing.status}</span></article>)}</div> : <p className="empty-calendar-day">Nothing scheduled. Add an open time above.</p>}</div></div>
      <section className="viewing-requests-section"><div className="calendar-heading"><h2>All requests</h2><span>{viewings.filter((viewing) => viewing.status === 'pending').length} pending</span></div>{viewings.length ? requestList : <p className="empty-calendar-day">Buyer requests will appear here.</p>}</section>
    </>}
    {auth.user.role === 'buyer' && <>
      <div className="viewing-calendar"><div className="calendar-heading"><h2>Your next 14 days</h2><span>Confirmed visits appear here automatically</span></div><div className="calendar-days" role="group" aria-label="Choose a day"><div className="calendar-day-scroll">{calendarDays.map((day) => { const key = dayKey(day); const count = viewings.filter((viewing) => ['pending', 'accepted'].includes(viewing.status) && dayKey(viewing.requestedFor) === key).length; return <button type="button" key={key} className={`calendar-day${selectedDay === key ? ' selected' : ''}`} aria-pressed={selectedDay === key} onClick={() => setSelectedDay(key)}><span>{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong><small>{count} {count === 1 ? 'visit' : 'visits'}</small></button>; })}</div></div><div className="calendar-agenda"><h3>{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${selectedDay}T12:00:00`))}</h3>{viewings.filter((viewing) => ['pending', 'accepted'].includes(viewing.status) && dayKey(viewing.requestedFor) === selectedDay).sort((a, b) => new Date(a.requestedFor) - new Date(b.requestedFor)).length ? <div className="calendar-events">{viewings.filter((viewing) => ['pending', 'accepted'].includes(viewing.status) && dayKey(viewing.requestedFor) === selectedDay).sort((a, b) => new Date(a.requestedFor) - new Date(b.requestedFor)).map((viewing) => <article className="calendar-event calendar-booked-slot" key={viewing._id}><time>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(viewing.requestedFor))}</time><div><strong>{viewing.property?.title || 'Listing unavailable'}</strong><span>{viewing.property?.area}, {viewing.property?.city}</span></div><span className={`viewing-status viewing-${viewing.status}`}>{viewing.status}</span>{viewing.status === 'accepted' && <button className="button button-quiet button-small" disabled={busyId === viewing._id} onClick={() => downloadCalendarEvent(viewing)}>Add to calendar</button>}</article>)}</div> : <p className="empty-calendar-day">No visits scheduled for this day.</p>}</div></div>
      {viewings.length ? requestList : <div className="empty-state"><h2>No viewing requests yet</h2><p>Request a visit from a property page to get started.</p><Link className="button" to="/properties">Explore homes</Link></div>}
    </>}
  </>}</section>;
}

export function SavedSearchAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = () => api.get('/api/search-alerts').then(({ data }) => setAlerts(data.alerts)).catch((requestError) => setError(requestError.response?.data?.message || 'Could not load search alerts.')).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, []);
  const remove = async (alertId) => { try { await api.delete(`/api/search-alerts/${alertId}`); setAlerts((current) => current.filter((alert) => alert._id !== alertId)); } catch (requestError) { setError(requestError.response?.data?.message || 'Could not remove this alert.'); } };
  return <section className="page-wrap saved-alerts-page"><div className="page-intro"><span className="eyebrow">New matches</span><h1>Search alerts</h1><p>New homes that match your saved searches appear here.</p></div>{error && <p className="error-banner" role="alert">{error}</p>}{loading ? <p className="loading" role="status">Checking saved searches…</p> : alerts.length ? <div className="saved-alert-list">{alerts.map((alert) => <section className="saved-alert" key={alert._id}><div className="saved-alert-heading"><div><h2>{alert.name}</h2><p className="muted">Saved {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(alert.createdAt))}</p></div><button className="button button-quiet button-small" onClick={() => remove(alert._id)}>Remove alert</button></div>{alert.matches.length ? <><p className="alert-match-count">{alert.matches.length} new {alert.matches.length === 1 ? 'match' : 'matches'}</p><div className="property-grid">{alert.matches.map((property) => <PropertyCard key={property._id} property={property}/>)}</div></> : <p className="empty-alert">No new matches yet. We’ll show matching listings added after this search was saved.</p>}</section>)}</div> : <div className="empty-state"><h2>No saved searches</h2><p>Save filters from the property search page to get new listing alerts here.</p><Link className="button" to="/properties">Find homes</Link></div>}</section>;
}

export function SavedHomes() {
  const { savedIds } = usePropertyTools();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get('/api/favorites').then(({ data }) => { if (active) setProperties(data.properties); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load saved homes.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [savedIds.join(',')]);
  return <section className="page-wrap saved-page"><div className="page-intro"><span className="eyebrow">Your shortlist</span><h1>Saved homes</h1><p>Keep the places you’re considering together.</p></div>{error && <p className="error-banner" role="alert">{error}</p>}{loading ? <p className="loading" role="status">Loading saved homes…</p> : properties.length ? <div className="property-grid">{properties.map((property) => <PropertyCard key={property._id} property={property}/>)}</div> : <div className="empty-state"><h2>No saved homes yet</h2><p>Save a listing with the heart button and it’ll appear here.</p><Link className="button" to="/properties">Explore homes</Link></div>}</section>;
}

export function CompareHomes() {
  const { comparisonIds, toggleComparison, setComparisonIds } = usePropertyTools();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!comparisonIds.length) { setProperties([]); setLoading(false); return undefined; }
    let active = true;
    setLoading(true);
    setError('');
    api.get('/api/property/compare', { params: { ids: comparisonIds.join(',') } })
      .then(({ data }) => { if (active) setProperties(data.properties); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load homes to compare.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [comparisonIds.join(',')]);
  const remove = (id) => {
    toggleComparison(id);
    setProperties((current) => current.filter((property) => String(property._id) !== String(id)));
  };
  const rows = [
    ['Price', (property) => `${money(property.price)}${property.purpose === 'rent' ? ' / month' : ''}`],
    ['Purpose', (property) => property.purpose === 'rent' ? 'For rent' : property.status === 'sold' ? 'Sold' : 'For sale'],
    ['Property type', (property) => property.propertyType],
    ['Location', (property) => [property.area, property.city, property.pincode].filter(Boolean).join(', ')],
    ['Bedrooms', (property) => property.bhk ? `${property.bhk} BHK` : '—'],
    ['Bathrooms', (property) => property.bathrooms || '—'],
    ['Area', (property) => property.areaSize ? `${property.areaSize.toLocaleString()} sq ft` : '—'],
    ['Furnishing', (property) => property.furnishing || '—'],
    ['Amenities', (property) => property.amenities?.length ? property.amenities.join(', ') : '—'],
    ['Seller', (property) => property.seller?.name || '—'],
  ];
  return <section className="page-wrap compare-page"><div className="page-intro"><span className="eyebrow">Make a considered choice</span><h1>Compare homes</h1><p>Review the details side by side. Select up to four listings to compare.</p></div>{error && <p className="error-banner" role="alert">{error}</p>}{loading ? <p className="loading" role="status">Loading homes…</p> : properties.length ? <><div className="compare-toolbar"><span>{properties.length} of 4 homes selected</span><button className="text-link compare-clear" type="button" onClick={() => { setComparisonIds([]); setProperties([]); }}>Clear comparison</button></div><div className="compare-table-wrap"><table className="compare-table"><thead><tr><th scope="col">Property details</th>{properties.map((property) => <th scope="col" key={property._id}><div className="compare-property-head"><Link to={`/properties/${property._id}`}><img src={property.images?.[0]} alt=""/><strong>{property.title}</strong></Link><button type="button" onClick={() => remove(property._id)} aria-label={`Remove ${property.title} from comparison`}>Remove</button></div></th>)}</tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{properties.map((property) => <td key={property._id}>{value(property)}</td>)}</tr>)}</tbody></table></div></> : <div className="empty-state"><h2>Add homes to compare</h2><p>Use “Compare” on any listing to see prices, locations and features side by side.</p><Link className="button" to="/properties">Explore homes</Link></div>}</section>;
}


