import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../app/api.js';
import { money } from '../../../app/formatters.js';
import { usePropertyTools } from '../../../app/property-tools.jsx';

export function CompareHomes() {
  const { comparisonIds, toggleComparison, setComparisonIds } = usePropertyTools();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const comparisonKey = comparisonIds.join(',');
  useEffect(() => {
    if (!comparisonKey) {
      setProperties([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    api
      .get('/api/property/compare', { params: { ids: comparisonKey } })
      .then(({ data }) => {
        if (active) setProperties(data.properties);
      })
      .catch((requestError) => {
        if (active)
          setError(requestError.response?.data?.message || 'Could not load homes to compare.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [comparisonKey]);
  const remove = (id) => {
    toggleComparison(id);
    setProperties((current) => current.filter((property) => String(property._id) !== String(id)));
  };
  const rows = [
    [
      'Price',
      (property) => `${money(property.price)}${property.purpose === 'rent' ? ' / month' : ''}`,
    ],
    [
      'Purpose',
      (property) =>
        property.purpose === 'rent' ? 'For rent' : property.status === 'sold' ? 'Sold' : 'For sale',
    ],
    ['Property type', (property) => property.propertyType],
    [
      'Location',
      (property) => [property.area, property.city, property.pincode].filter(Boolean).join(', '),
    ],
    ['Bedrooms', (property) => (property.bhk ? `${property.bhk} BHK` : '—')],
    ['Bathrooms', (property) => property.bathrooms || '—'],
    [
      'Area',
      (property) => (property.areaSize ? `${property.areaSize.toLocaleString()} sq ft` : '—'),
    ],
    ['Furnishing', (property) => property.furnishing || '—'],
    ['Amenities', (property) => (property.amenities?.length ? property.amenities.join(', ') : '—')],
    ['Seller', (property) => property.seller?.name || '—'],
  ];
  return (
    <section className="page-wrap compare-page">
      <div className="page-intro">
        <span className="eyebrow">Make a considered choice</span>
        <h1>Compare homes</h1>
        <p>Review the details side by side. Select up to four listings to compare.</p>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="loading" role="status">
          Loading homes…
        </p>
      ) : properties.length ? (
        <>
          <div className="compare-toolbar">
            <span>{properties.length} of 4 homes selected</span>
            <button
              className="text-link compare-clear"
              type="button"
              onClick={() => {
                setComparisonIds([]);
                setProperties([]);
              }}
            >
              Clear comparison
            </button>
          </div>
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">Property details</th>
                  {properties.map((property) => (
                    <th scope="col" key={property._id}>
                      <div className="compare-property-head">
                        <Link to={`/properties/${property._id}`}>
                          <img src={property.images?.[0]} alt="" />
                          <strong>{property.title}</strong>
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove(property._id)}
                          aria-label={`Remove ${property.title} from comparison`}
                        >
                          Remove
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([label, value]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {properties.map((property) => (
                      <td key={property._id}>{value(property)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h2>Add homes to compare</h2>
          <p>Use “Compare” on any listing to see prices, locations and features side by side.</p>
          <Link className="button" to="/properties">
            Explore homes
          </Link>
        </div>
      )}
    </section>
  );
}
