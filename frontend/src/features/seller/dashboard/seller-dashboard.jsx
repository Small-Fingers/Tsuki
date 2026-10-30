import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../app/api.js';
import { useAuth } from '../../../app/auth.jsx';
import { money } from '../../../app/formatters.js';
import { availabilityInfo } from '../../marketplace/property-info.js';

function Sparkline({ values, label, tone }) {
  const max = Math.max(1, ...values);
  const points = values
    .map(
      (value, index) =>
        `${values.length > 1 ? index * (100 / (values.length - 1)) : 50},${30 - (value / max) * 25}`,
    )
    .join(' ');
  return (
    <svg
      className={`analytics-sparkline ${tone}`}
      viewBox="0 0 100 34"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}, daily values ${values.join(', ')}`}
    >
      <polyline points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Dashboard() {
  const auth = useAuth();
  const [items, setItems] = useState([]);
  const [analytics, setAnalytics] = useState({
    summary: { views: 0, saves: 0, conversations: 0, viewings: 0, pendingViewings: 0 },
    listings: [],
    trend: [],
  });
  const [period, setPeriod] = useState(7);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const refresh = useCallback(
    () =>
      Promise.all([
        api.get('/api/property/mine'),
        api.get(`/api/property/mine/analytics?days=${period}`),
      ])
        .then(([propertiesResponse, analyticsResponse]) => {
          setItems(propertiesResponse.data.properties);
          setAnalytics(analyticsResponse.data);
        })
        .catch((requestError) =>
          setError(requestError.response?.data?.message || 'Could not load your listings'),
        ),
    [period],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);
  const remove = async (property) => {
    if (!confirm('Delete this listing?')) return;
    try {
      await api.delete(`/api/property/${property._id}`);
      refresh();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not delete listing');
    }
  };
  const updateStatus = async (property, status) => {
    setBusyId(property._id);
    setError('');
    try {
      const { data } = await api.patch(`/api/property/${property._id}`, { status });
      setItems((current) =>
        current.map((item) => (item._id === property._id ? data.property : item)),
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update availability');
    } finally {
      setBusyId('');
    }
  };
  const confirmAvailability = async (property) => {
    setBusyId(property._id);
    setError('');
    try {
      const { data } = await api.patch(`/api/property/${property._id}/availability`);
      setItems((current) =>
        current.map((item) => (item._id === property._id ? data.property : item)),
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not confirm this listing.');
    } finally {
      setBusyId('');
    }
  };
  const listingAnalytics = new Map(
    analytics.listings.map((listing) => [listing.propertyId, listing]),
  );
  const trendValues = (metric) => analytics.trend.map((day) => day[metric] || 0);
  return (
    <section className="page-wrap">
      <div className="dashboard-heading">
        <div>
          <span className="eyebrow">Your space</span>
          <h1>Seller dashboard</h1>
          <p className="muted">Welcome, {auth.user.name}. Keep your listings up to date.</p>
        </div>
        <div className="dashboard-heading-actions">
          <Link className="button button-quiet" to="/leads">
            Manage leads
          </Link>
          <Link className="button" to="/new-listing">
            Add a listing +
          </Link>
        </div>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <div className="analytics-title-row">
        <div>
          <h2 className="analytics-heading">Listing performance</h2>
          <p className="analytics-caption">Lifetime totals; daily trends start collecting now.</p>
        </div>
        <div className="analytics-period" role="group" aria-label="Activity trend period">
          <button
            type="button"
            className={period === 7 ? 'selected' : ''}
            aria-pressed={period === 7}
            onClick={() => setPeriod(7)}
          >
            7 days
          </button>
          <button
            type="button"
            className={period === 30 ? 'selected' : ''}
            aria-pressed={period === 30}
            onClick={() => setPeriod(30)}
          >
            30 days
          </button>
        </div>
      </div>
      <div className="dashboard-stats analytics-stats">
        <div>
          <span>Available listings</span>
          <b>{items.filter((property) => property.status === 'sale').length}</b>
        </div>
        <div>
          <span>Views</span>
          <b>{analytics.summary.views}</b>
          <Sparkline
            values={trendValues('views')}
            label={`Views over ${period} days`}
            tone="spark-views"
          />
          <small>Daily · {period} days</small>
        </div>
        <div>
          <span>Saved by buyers</span>
          <b>{analytics.summary.saves}</b>
          <Sparkline
            values={trendValues('saves')}
            label={`New saves over ${period} days`}
            tone="spark-saves"
          />
          <small>Daily · {period} days</small>
        </div>
        <div>
          <span>Conversations</span>
          <b>{analytics.summary.conversations}</b>
          <Sparkline
            values={trendValues('conversations')}
            label={`New conversations over ${period} days`}
            tone="spark-conversations"
          />
          <small>Daily · {period} days</small>
        </div>
        <div>
          <span>Viewing requests</span>
          <b>{analytics.summary.viewings}</b>
          <Sparkline
            values={trendValues('viewings')}
            label={`New viewing requests over ${period} days`}
            tone="spark-viewings"
          />
          <small>{analytics.summary.pendingViewings} pending</small>
        </div>
      </div>
      <div className="seller-list-heading">
        <h2>Your listings</h2>
        <span>
          {items.filter((property) => ['sold', 'rented'].includes(property.status)).length} sold or
          rented
        </span>
      </div>
      {items.length ? (
        <div className="seller-list">
          {items.map((property) => {
            const stats = listingAnalytics.get(String(property._id)) || {
              views: property.views || 0,
              saves: 0,
              conversations: 0,
              viewings: 0,
              pendingViewings: 0,
            };
            const freshness = availabilityInfo(property);
            return (
              <div className="seller-row" key={property._id}>
                <div className="row-thumb">
                  {property.images?.[0] ? <img src={property.images[0]} alt="" /> : '⌂'}
                </div>
                <div className="row-main">
                  <b>{property.title}</b>
                  <span className="muted">
                    {property.area}, {property.city} · {money(property.price)}
                    {property.purpose === 'rent' ? ' / month' : ''}
                  </span>
                  {freshness.label && (
                    <span
                      className={`availability-freshness${freshness.stale ? ' needs-confirmation' : ''}`}
                    >
                      {freshness.label}
                    </span>
                  )}
                  <span className="listing-metrics">
                    <span>{stats.views} views</span>
                    <span>{stats.saves} saves</span>
                    <span>{stats.conversations} conversations</span>
                    <span>
                      {stats.viewings} viewings
                      {stats.pendingViewings > 0 ? ` · ${stats.pendingViewings} pending` : ''}
                    </span>
                  </span>
                </div>
                <div className="availability-control">
                  <span>Status</span>
                  <select
                    aria-label={`Availability for ${property.title}`}
                    disabled={busyId === property._id}
                    value={property.status || 'sale'}
                    onChange={(event) => updateStatus(property, event.target.value)}
                  >
                    <option value="sale">Available</option>
                    {property.purpose === 'rent' ? (
                      <option value="rented">Rented</option>
                    ) : (
                      <option value="sold">Sold</option>
                    )}
                    <option value="unavailable">Unavailable</option>
                  </select>
                  {property.status === 'sale' && (
                    <button
                      className="confirm-availability-button"
                      type="button"
                      disabled={busyId === property._id}
                      onClick={() => confirmAvailability(property)}
                    >
                      {busyId === property._id ? 'Saving…' : 'Confirm availability'}
                    </button>
                  )}
                </div>
                <Link className="text-link" to={`/edit-listing/${property._id}`}>
                  Edit
                </Link>
                <button className="button button-quiet" onClick={() => remove(property)}>
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">No listings yet. Add your first home when you’re ready.</div>
      )}
    </section>
  );
}
