import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PropertyCard } from '../../marketplace/components/PropertyCard.jsx';
import { api } from '../../../app/api.js';

export function SavedSearchAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = () =>
    api
      .get('/api/search-alerts')
      .then(({ data }) => setAlerts(data.alerts))
      .catch((requestError) =>
        setError(requestError.response?.data?.message || 'Could not load search alerts.'),
      )
      .finally(() => setLoading(false));
  useEffect(() => {
    refresh();
  }, []);
  const remove = async (alertId) => {
    try {
      await api.delete(`/api/search-alerts/${alertId}`);
      setAlerts((current) => current.filter((alert) => alert._id !== alertId));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not remove this alert.');
    }
  };
  return (
    <section className="page-wrap saved-alerts-page">
      <div className="page-intro">
        <span className="eyebrow">New matches</span>
        <h1>Search alerts</h1>
        <p>New homes that match your saved searches appear here.</p>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="loading" role="status">
          Checking saved searches…
        </p>
      ) : alerts.length ? (
        <div className="saved-alert-list">
          {alerts.map((alert) => (
            <section className="saved-alert" key={alert._id}>
              <div className="saved-alert-heading">
                <div>
                  <h2>{alert.name}</h2>
                  <p className="muted">
                    Saved{' '}
                    {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                      new Date(alert.createdAt),
                    )}
                  </p>
                </div>
                <button
                  className="button button-quiet button-small"
                  onClick={() => remove(alert._id)}
                >
                  Remove alert
                </button>
              </div>
              {alert.matches.length ? (
                <>
                  <p className="alert-match-count">
                    {alert.matches.length} new {alert.matches.length === 1 ? 'match' : 'matches'}
                  </p>
                  <div className="property-grid">
                    {alert.matches.map((property) => (
                      <PropertyCard key={property._id} property={property} />
                    ))}
                  </div>
                </>
              ) : (
                <p className="empty-alert">
                  No new matches yet. We’ll show matching listings added after this search was
                  saved.
                </p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No saved searches</h2>
          <p>Save filters from the property search page to get new listing alerts here.</p>
          <Link className="button" to="/properties">
            Find homes
          </Link>
        </div>
      )}
    </section>
  );
}
