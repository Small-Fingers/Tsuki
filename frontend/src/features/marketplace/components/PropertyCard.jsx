import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/auth.jsx';
import { usePrefersReducedMotion } from '../../../app/motion.js';
import { usePropertyTools } from '../../../app/property-tools.jsx';
import { availabilityInfo, availabilityLabel } from '../property-info.js';
import { money } from '../../../app/formatters.js';
export function PropertyCard({ property, autoRotate = false, rotationDelay = 0 }) {
  const auth = useAuth();
  const tools = usePropertyTools();
  const navigate = useNavigate();
  const [actionMessage, setActionMessage] = useState('');
  const [imageIndex, setImageIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const images = property.images || [];
  const saved = tools.savedIds.includes(String(property._id));
  const selected = tools.comparisonIds.includes(String(property._id));
  const trustLabel = [
    property.isVerified ? 'Tsuki reviewed listing' : 'listing review pending',
    availabilityInfo(property).label,
    property.propertyReviewSummary?.count > 0 &&
      `home rating ${property.propertyReviewSummary.rating} from ${property.propertyReviewSummary.count} buyer reviews`,
    property.sellerReviewSummary?.count > 0 &&
      `seller rating ${property.sellerReviewSummary.rating} from ${property.sellerReviewSummary.count} buyer reviews`,
  ]
    .filter(Boolean)
    .join(', ');

  useEffect(() => {
    setImageIndex(0);
    if (!autoRotate || images.length < 2 || reducedMotion) return undefined;
    let interval;
    const timeout = window.setTimeout(() => {
      setImageIndex((current) => (current + 1) % images.length);
      interval = window.setInterval(
        () => setImageIndex((current) => (current + 1) % images.length),
        5000,
      );
    }, 5000 + rotationDelay);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [autoRotate, property._id, images.length, rotationDelay, reducedMotion]);

  const saveProperty = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setActionMessage('');
    if (!auth?.user) {
      navigate('/login');
      return;
    }
    const result = await tools.toggleSaved(property._id);
    if (!result.success) setActionMessage(result.message || 'Sign in as a buyer to save homes.');
  };
  const compareProperty = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const result = tools.toggleComparison(property._id);
    setActionMessage(result.message || '');
  };

  return (
    <article className="property-card">
      <Link
        className="property-card-main"
        to={`/properties/${property._id}`}
        aria-label={`${property.title}, ${money(property.price)}${property.purpose === 'rent' ? ' per month' : ''}, ${trustLabel}`}
      >
        <div className="property-image">
          {images[imageIndex] ? (
            <img
              key={images[imageIndex]}
              className={autoRotate ? 'auto-rotating-photo' : ''}
              src={images[imageIndex]}
              alt={`${property.title}${images.length > 1 ? ` — ${imageIndex + 1} of ${images.length}` : ''}`}
              loading="lazy"
            />
          ) : (
            <div className="image-placeholder">⌂</div>
          )}
          {autoRotate && images.length > 1 && (
            <span className="card-photo-count" aria-hidden="true">
              0{imageIndex + 1} / 0{images.length}
            </span>
          )}
          <span
            className={`tag ${property.status === 'sold' || property.status === 'rented' || property.status === 'unavailable' ? 'tag-sold' : property.purpose === 'rent' ? 'tag-rent' : 'tag-sale'}`}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 7.2 8 2l6 5.2v6.3H2z" />
            </svg>
            {availabilityLabel(property)}
          </span>
          {property.isVerified && (
            <span
              className="verified-mark"
              title="A Tsuki administrator reviewed this listing. This does not certify the property’s condition."
            >
              <span aria-hidden="true">✓</span> Verified
            </span>
          )}
          <span className="property-open" aria-hidden="true">
            ↗
          </span>
        </div>
        <div className="property-info">
          <div className="property-price-line">
            <span className="price">{money(property.price)}</span>
            {property.purpose === 'rent' && <span className="price-period">/ month</span>}
          </div>
          <h3>{property.title}</h3>
          <p className="property-location">
            <span aria-hidden="true">⌖</span> {property.area}, {property.city}
          </p>
          <div className="property-trust" aria-label="Listing freshness, review and buyer feedback">
            {availabilityInfo(property).label && (
              <span
                className={`availability-freshness${availabilityInfo(property).stale ? ' needs-confirmation' : ''}`}
              >
                {availabilityInfo(property).label}
              </span>
            )}
            {!property.isVerified && (
              <span
                className="card-review-pending"
                title="This listing has not yet been reviewed by a Tsuki administrator."
              >
                Review pending
              </span>
            )}
            {property.propertyReviewSummary?.count > 0 && (
              <span
                aria-label={`Home rating ${property.propertyReviewSummary.rating} out of 5 from ${property.propertyReviewSummary.count} buyer reviews`}
              >
                ★ {property.propertyReviewSummary.rating}{' '}
                <small>home · {property.propertyReviewSummary.count}</small>
              </span>
            )}
            {property.sellerReviewSummary?.count > 0 && (
              <span
                aria-label={`Seller rating ${property.sellerReviewSummary.rating} out of 5 from ${property.sellerReviewSummary.count} buyer reviews`}
              >
                ★ {property.sellerReviewSummary.rating}{' '}
                <small>seller · {property.sellerReviewSummary.count}</small>
              </span>
            )}
          </div>
          <div className="property-meta">
            <span>{property.bhk ? `${property.bhk} BHK` : property.propertyType}</span>
            {property.areaSize ? <span>{property.areaSize.toLocaleString()} sq ft</span> : null}
            {property.bathrooms ? <span>{property.bathrooms} bath</span> : null}
          </div>
        </div>
      </Link>
      <div className="property-card-actions">
        {(!auth?.user || auth.user.role === 'buyer') && (
          <button
            type="button"
            className={`property-action${saved ? ' is-saved' : ''}`}
            onClick={saveProperty}
            aria-pressed={saved}
            aria-label={
              saved ? `Remove ${property.title} from saved homes` : `Save ${property.title}`
            }
          >
            <span aria-hidden="true">{saved ? '♥' : '♡'}</span>
            {saved ? 'Saved' : 'Save'}
          </button>
        )}
        <button
          type="button"
          className={`property-action${selected ? ' is-selected' : ''}`}
          onClick={compareProperty}
          aria-pressed={selected}
          aria-label={
            selected
              ? `Remove ${property.title} from comparison`
              : `Add ${property.title} to comparison`
          }
        >
          {selected ? 'Added to compare' : 'Compare'}
        </button>
      </div>
      {actionMessage && (
        <p className="property-action-message" role="status">
          {actionMessage}
        </p>
      )}
    </article>
  );
}
