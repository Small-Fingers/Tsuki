import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../app/api.js';
import { useAuth } from '../../../app/auth.jsx';
import { money, localDateKey } from '../../../app/formatters.js';
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
  const refresh = useCallback(() => {
    const requests = [api.get('/api/viewings')];
    if (auth.user.role === 'seller')
      requests.push(api.get('/api/viewings/availability/mine'), api.get('/api/property/mine'));
    Promise.all(requests)
      .then(([viewingResponse, slotResponse, propertyResponse]) => {
        setViewings(viewingResponse.data.viewings);
        if (slotResponse) setSlots(slotResponse.data.slots);
        if (propertyResponse) {
          const availableListings = propertyResponse.data.properties.filter(
            (property) => property.purpose !== 'rent' && property.status === 'sale',
          );
          setListings(availableListings);
          setSelectedProperty((current) => current || availableListings[0]?._id || '');
        }
        setError('');
      })
      .catch((requestError) =>
        setError(requestError.response?.data?.message || 'Could not load viewing requests.'),
      )
      .finally(() => setLoading(false));
  }, [auth.user.role]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const calendarDays = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(today);
    day.setDate(day.getDate() + index);
    return day;
  });
  const dayKey = localDateKey;
  const dayEvents = [
    ...slots
      .filter((slot) => slot.status === 'available')
      .map((slot) => ({ type: 'slot', startsAt: slot.startsAt, slot })),
    ...viewings
      .filter((viewing) => ['pending', 'accepted'].includes(viewing.status))
      .map((viewing) => ({ type: 'viewing', startsAt: viewing.requestedFor, viewing })),
  ]
    .filter((event) => dayKey(event.startsAt) === selectedDay)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const eventCount = (day) => dayEventsFor(dayKey(day)).length;
  const dayEventsFor = (key) => [
    ...slots.filter((slot) => slot.status === 'available' && dayKey(slot.startsAt) === key),
    ...viewings.filter(
      (viewing) =>
        ['pending', 'accepted'].includes(viewing.status) && dayKey(viewing.requestedFor) === key,
    ),
  ];
  const addSlot = async (event) => {
    event.preventDefault();
    setSlotMessage('');
    setError('');
    try {
      const startsAt = new Date(`${slotDate}T${slotTime}`);
      const { data } = await api.post('/api/viewings/availability', {
        propertyId: selectedProperty,
        startsAt: startsAt.toISOString(),
      });
      setSlotMessage('Viewing time added to your calendar.');
      setSelectedDay(dayKey(data.slot.startsAt));
      setSlotTime('');
      refresh();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not add this viewing time.');
    }
  };
  const removeSlot = async (slot) => {
    try {
      await api.delete(`/api/viewings/availability/${slot._id}`);
      setSlots((current) => current.filter((item) => item._id !== slot._id));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not remove this time.');
    }
  };
  const update = async (viewing, status) => {
    setBusyId(viewing._id);
    setError('');
    try {
      const { data } = await api.patch(`/api/viewings/${viewing._id}`, { status });
      setViewings((current) =>
        current.map((item) =>
          item._id === viewing._id
            ? {
                ...item,
                ...data.viewing,
                property: item.property,
                buyer: item.buyer,
                seller: item.seller,
              }
            : item,
        ),
      );
      if (auth.user.role === 'seller') refresh();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update this request.');
    } finally {
      setBusyId('');
    }
  };
  const downloadCalendarEvent = async (viewing) => {
    setBusyId(viewing._id);
    setError('');
    try {
      const { data } = await api.get(`/api/viewings/${viewing._id}/calendar`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `tsuki-viewing-${localDateKey(viewing.requestedFor)}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not create a calendar event.');
    } finally {
      setBusyId('');
    }
  };
  const requestList = viewings.length ? (
    <div className="viewing-list">
      {viewings.map((viewing) => {
        const other = auth.user.role === 'seller' ? viewing.buyer : viewing.seller;
        return (
          <article className="viewing-item" key={viewing._id}>
            <div className="viewing-thumb">
              {viewing.property?.images?.[0] && <img src={viewing.property.images[0]} alt="" />}
            </div>
            <div className="viewing-info">
              <Link to={`/properties/${viewing.property?._id}`}>
                <strong>{viewing.property?.title || 'Listing unavailable'}</strong>
              </Link>
              <span>
                {viewing.property?.area}, {viewing.property?.city} ·{' '}
                {money(viewing.property?.price || 0)}
                {viewing.property?.purpose === 'rent' ? ' / month' : ''}
              </span>
              <span>
                {auth.user.role === 'seller' ? 'Requested by' : 'Seller'}:{' '}
                {other?.name || 'Tsuki member'}
                {other?.phone ? ` · ${other.phone}` : ''}
              </span>
              {viewing.note && <p>{viewing.note}</p>}
            </div>
            <div className="viewing-actions">
              <time dateTime={viewing.requestedFor}>
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(viewing.requestedFor))}
              </time>
              <span className={`viewing-status viewing-${viewing.status}`}>{viewing.status}</span>
              {viewing.status === 'accepted' && (
                <button
                  className="button button-quiet button-small"
                  disabled={busyId === viewing._id}
                  onClick={() => downloadCalendarEvent(viewing)}
                >
                  Add to calendar
                </button>
              )}
              {auth.user.role === 'seller' && viewing.status === 'pending' && (
                <div>
                  <button
                    className="button button-small"
                    disabled={busyId === viewing._id}
                    onClick={() => update(viewing, 'accepted')}
                  >
                    Accept
                  </button>
                  <button
                    className="button button-quiet button-small"
                    disabled={busyId === viewing._id}
                    onClick={() => update(viewing, 'declined')}
                  >
                    Decline
                  </button>
                </div>
              )}
              {auth.user.role === 'buyer' && ['pending', 'accepted'].includes(viewing.status) && (
                <div>
                  <button
                    className="button button-quiet button-small"
                    disabled={busyId === viewing._id}
                    onClick={() => update(viewing, 'cancelled')}
                  >
                    Cancel viewing
                  </button>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  ) : (
    <div className="empty-state">
      <h2>No viewing requests yet</h2>
      <p>
        {auth.user.role === 'seller'
          ? 'Buyer requests will appear here.'
          : 'Request a visit from a property page to get started.'}
      </p>
      <Link className="button" to="/properties">
        Explore homes
      </Link>
    </div>
  );
  return (
    <section className="page-wrap viewings-page">
      <div className="page-intro">
        <span className="eyebrow">Property visits</span>
        <h1>{auth.user.role === 'seller' ? 'Viewing calendar' : 'Viewing requests'}</h1>
        <p>
          {auth.user.role === 'seller'
            ? 'Set open times for buyers and manage confirmed visits.'
            : 'Track your requested property viewings.'}
        </p>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="loading" role="status">
          Loading viewing requests…
        </p>
      ) : (
        <>
          {auth.user.role === 'seller' && (
            <>
              <section className="slot-manager">
                <div className="slot-manager-heading">
                  <div>
                    <span className="eyebrow">Seller availability</span>
                    <h2>Add an open time</h2>
                    <p>Slots are 30 minutes and become unavailable when a buyer requests them.</p>
                  </div>
                </div>
                {slotMessage && (
                  <p className="success-banner" role="status">
                    {slotMessage}
                  </p>
                )}
                {listings.length ? (
                  <form className="slot-create-form" onSubmit={addSlot}>
                    <label>
                      Listing
                      <select
                        value={selectedProperty}
                        onChange={(event) => setSelectedProperty(event.target.value)}
                        required
                      >
                        {listings.map((property) => (
                          <option key={property._id} value={property._id}>
                            {property.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Date
                      <input
                        type="date"
                        required
                        min={localDateKey(today)}
                        max={localDateKey(calendarDays[13])}
                        value={slotDate}
                        onChange={(event) => setSlotDate(event.target.value)}
                      />
                    </label>
                    <label>
                      Start time
                      <select
                        required
                        value={slotTime}
                        onChange={(event) => setSlotTime(event.target.value)}
                      >
                        <option value="">Choose a time</option>
                        {Array.from({ length: 24 }, (_, index) => {
                          const hour = Math.floor(index / 2) + 8;
                          const minute = index % 2 ? '30' : '00';
                          const value = `${String(hour).padStart(2, '0')}:${minute}`;
                          return (
                            <option key={value} value={value}>
                              {new Intl.DateTimeFormat(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              }).format(new Date(`2000-01-01T${value}:00`))}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                    <button
                      className="button"
                      disabled={!selectedProperty || !slotDate || !slotTime}
                    >
                      Add to calendar
                    </button>
                  </form>
                ) : (
                  <p className="muted">
                    Create an available sale listing before adding viewing times.
                  </p>
                )}
              </section>
              <div className="viewing-calendar">
                <div className="calendar-heading">
                  <h2>Next 14 days</h2>
                  <span>Local time</span>
                </div>
                <div className="calendar-days" role="group" aria-label="Choose a day">
                  <div className="calendar-day-scroll">
                    {calendarDays.map((day) => {
                      const key = dayKey(day);
                      return (
                        <button
                          type="button"
                          key={key}
                          className={`calendar-day${selectedDay === key ? ' selected' : ''}`}
                          aria-pressed={selectedDay === key}
                          onClick={() => setSelectedDay(key)}
                        >
                          <span>
                            {new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)}
                          </span>
                          <strong>{day.getDate()}</strong>
                          <small>
                            {eventCount(day)} {eventCount(day) === 1 ? 'event' : 'events'}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="calendar-agenda">
                  <h3>
                    {new Intl.DateTimeFormat(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    }).format(new Date(`${selectedDay}T12:00:00`))}
                  </h3>
                  {dayEvents.length ? (
                    <div className="calendar-events">
                      {dayEvents.map((event) =>
                        event.type === 'slot' ? (
                          <article
                            className="calendar-event calendar-open-slot"
                            key={event.slot._id}
                          >
                            <time>
                              {new Intl.DateTimeFormat(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              }).format(new Date(event.startsAt))}
                            </time>
                            <div>
                              <strong>Open viewing time</strong>
                              <span>{event.slot.property?.title || 'Your listing'}</span>
                            </div>
                            <span className="viewing-status">Available</span>
                            <button
                              className="button button-quiet button-small"
                              onClick={() => removeSlot(event.slot)}
                            >
                              Remove
                            </button>
                          </article>
                        ) : (
                          <article
                            className="calendar-event calendar-booked-slot"
                            key={event.viewing._id}
                          >
                            <time>
                              {new Intl.DateTimeFormat(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              }).format(new Date(event.startsAt))}
                            </time>
                            <div>
                              <strong>
                                {event.viewing.property?.title || 'Listing unavailable'}
                              </strong>
                              <span>
                                {event.viewing.status === 'pending'
                                  ? `Requested by ${event.viewing.buyer?.name || 'a buyer'}`
                                  : `${event.viewing.status[0].toUpperCase()}${event.viewing.status.slice(1)} · ${event.viewing.buyer?.name || 'Buyer'}`}
                              </span>
                            </div>
                            <span className={`viewing-status viewing-${event.viewing.status}`}>
                              {event.viewing.status}
                            </span>
                          </article>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="empty-calendar-day">Nothing scheduled. Add an open time above.</p>
                  )}
                </div>
              </div>
              <section className="viewing-requests-section">
                <div className="calendar-heading">
                  <h2>All requests</h2>
                  <span>
                    {viewings.filter((viewing) => viewing.status === 'pending').length} pending
                  </span>
                </div>
                {viewings.length ? (
                  requestList
                ) : (
                  <p className="empty-calendar-day">Buyer requests will appear here.</p>
                )}
              </section>
            </>
          )}
          {auth.user.role === 'buyer' && (
            <>
              <div className="viewing-calendar">
                <div className="calendar-heading">
                  <h2>Your next 14 days</h2>
                  <span>Confirmed visits appear here automatically</span>
                </div>
                <div className="calendar-days" role="group" aria-label="Choose a day">
                  <div className="calendar-day-scroll">
                    {calendarDays.map((day) => {
                      const key = dayKey(day);
                      const count = viewings.filter(
                        (viewing) =>
                          ['pending', 'accepted'].includes(viewing.status) &&
                          dayKey(viewing.requestedFor) === key,
                      ).length;
                      return (
                        <button
                          type="button"
                          key={key}
                          className={`calendar-day${selectedDay === key ? ' selected' : ''}`}
                          aria-pressed={selectedDay === key}
                          onClick={() => setSelectedDay(key)}
                        >
                          <span>
                            {new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)}
                          </span>
                          <strong>{day.getDate()}</strong>
                          <small>
                            {count} {count === 1 ? 'visit' : 'visits'}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="calendar-agenda">
                  <h3>
                    {new Intl.DateTimeFormat(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    }).format(new Date(`${selectedDay}T12:00:00`))}
                  </h3>
                  {viewings
                    .filter(
                      (viewing) =>
                        ['pending', 'accepted'].includes(viewing.status) &&
                        dayKey(viewing.requestedFor) === selectedDay,
                    )
                    .sort((a, b) => new Date(a.requestedFor) - new Date(b.requestedFor)).length ? (
                    <div className="calendar-events">
                      {viewings
                        .filter(
                          (viewing) =>
                            ['pending', 'accepted'].includes(viewing.status) &&
                            dayKey(viewing.requestedFor) === selectedDay,
                        )
                        .sort((a, b) => new Date(a.requestedFor) - new Date(b.requestedFor))
                        .map((viewing) => (
                          <article
                            className="calendar-event calendar-booked-slot"
                            key={viewing._id}
                          >
                            <time>
                              {new Intl.DateTimeFormat(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              }).format(new Date(viewing.requestedFor))}
                            </time>
                            <div>
                              <strong>{viewing.property?.title || 'Listing unavailable'}</strong>
                              <span>
                                {viewing.property?.area}, {viewing.property?.city}
                              </span>
                            </div>
                            <span className={`viewing-status viewing-${viewing.status}`}>
                              {viewing.status}
                            </span>
                            {viewing.status === 'accepted' && (
                              <button
                                className="button button-quiet button-small"
                                disabled={busyId === viewing._id}
                                onClick={() => downloadCalendarEvent(viewing)}
                              >
                                Add to calendar
                              </button>
                            )}
                          </article>
                        ))}
                    </div>
                  ) : (
                    <p className="empty-calendar-day">No visits scheduled for this day.</p>
                  )}
                </div>
              </div>
              {viewings.length ? (
                requestList
              ) : (
                <div className="empty-state">
                  <h2>No viewing requests yet</h2>
                  <p>Request a visit from a property page to get started.</p>
                  <Link className="button" to="/properties">
                    Explore homes
                  </Link>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
