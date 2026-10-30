import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PropertyCard } from '../../marketplace/components/PropertyCard.jsx';
import { api } from '../../../app/api.js';
import { usePropertyTools } from '../../../app/property-tools.jsx';

export function SavedHomes() {
  const { savedIds } = usePropertyTools();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const savedKey = savedIds.join(',');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .get('/api/favorites')
      .then(({ data }) => {
        if (active) setProperties(data.properties);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Could not load saved homes.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [savedKey]);
  return (
    <section className="page-wrap saved-page">
      <div className="page-intro">
        <span className="eyebrow">Your shortlist</span>
        <h1>Saved homes</h1>
        <p>Keep the places you’re considering together.</p>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="loading" role="status">
          Loading saved homes…
        </p>
      ) : properties.length ? (
        <div className="property-grid">
          {properties.map((property) => (
            <PropertyCard key={property._id} property={property} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No saved homes yet</h2>
          <p>Save a listing with the heart button and it’ll appear here.</p>
          <Link className="button" to="/properties">
            Explore homes
          </Link>
        </div>
      )}
    </section>
  );
}
