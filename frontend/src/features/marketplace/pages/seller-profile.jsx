import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../app/api.js';
import { PropertyCard } from '../components/PropertyCard.jsx';
export function SellerProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const [reviewError, setReviewError] = useState('');
  useEffect(() => {
    let active = true;
    api
      .get(`/api/property/sellers/${id}`)
      .then(({ data }) => {
        if (active) setProfile(data);
      })
      .catch((requestError) => {
        if (active)
          setError(requestError.response?.data?.message || 'Could not load this seller profile.');
      });
    return () => {
      active = false;
    };
  }, [id]);
  const loadMoreReviews = async () => {
    setLoadingMoreReviews(true);
    setReviewError('');
    const page = Math.floor(profile.reviews.length / 5) + 1;
    try {
      const { data } = await api.get(`/api/reviews/seller/${id}`, { params: { page } });
      setProfile((current) => ({
        ...current,
        reviews: [...current.reviews, ...data.reviews],
        reviewsHaveMore: data.hasMore,
      }));
    } catch (requestError) {
      setReviewError(requestError.response?.data?.message || 'Could not load more reviews.');
    } finally {
      setLoadingMoreReviews(false);
    }
  };
  if (error)
    return (
      <section className="page-wrap">
        <p className="error-banner" role="alert">
          {error}
        </p>
        <Link to="/properties">Browse properties</Link>
      </section>
    );
  if (!profile) return <p className="loading">Loading seller profile…</p>;
  const responseTime =
    profile.trust.averageResponseMinutes == null
      ? null
      : profile.trust.averageResponseMinutes < 60
        ? `About ${profile.trust.averageResponseMinutes} min`
        : `About ${(profile.trust.averageResponseMinutes / 60).toFixed(1)} hr`;
  return (
    <section className="page-wrap seller-profile-page">
      <Link className="text-link" to="/properties">
        ← Browse homes
      </Link>
      <header className="seller-profile-header">
        <div className="seller-profile-avatar">
          {profile.seller.profilePic ? (
            <img src={profile.seller.profilePic} alt="" />
          ) : (
            profile.seller.name?.charAt(0)?.toUpperCase()
          )}
        </div>
        <div>
          <span className="eyebrow">Seller profile</span>
          <h1>{profile.seller.name}</h1>
          <p>
            Member since{' '}
            {new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long' }).format(
              new Date(profile.seller.memberSince),
            )}
          </p>
        </div>
      </header>
      <div className="seller-trust-grid">
        <article>
          <span>Seller rating</span>
          <strong>{profile.rating ? `★ ${profile.rating}` : '—'}</strong>
          <small>
            {profile.reviewCount} buyer {profile.reviewCount === 1 ? 'review' : 'reviews'}
          </small>
        </article>
        <article>
          <span>Response rate</span>
          <strong>
            {profile.trust.responseRate == null ? '—' : `${profile.trust.responseRate}%`}
          </strong>
          <small>
            {profile.trust.responseSampleSize
              ? `Across ${profile.trust.responseSampleSize} conversations`
              : 'No response history yet'}
          </small>
        </article>
        <article>
          <span>Average reply</span>
          <strong>{responseTime || '—'}</strong>
          <small>{responseTime ? 'Based on buyer conversations' : 'No response history yet'}</small>
        </article>
        <article>
          <span>Active homes</span>
          <strong>{profile.trust.activeListings}</strong>
          <small>{profile.trust.reviewedListings} Tsuki-reviewed listings</small>
        </article>
      </div>
      {profile.reviews.length > 0 && (
        <section className="seller-profile-reviews">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Buyer experiences</span>
              <h2>Seller reviews</h2>
            </div>
          </div>
          <div className="review-list">
            {profile.reviews.map((review) => (
              <article className="review-card" key={review._id}>
                <div className="review-card-heading">
                  <strong>{review.reviewer?.name || 'Tsuki member'}</strong>
                  <span aria-label={`${review.rating} out of 5 stars`}>
                    {'★'.repeat(review.rating)}
                    <span className="empty-stars">{'★'.repeat(5 - review.rating)}</span>
                  </span>
                </div>
                <p>{review.comment}</p>
                <time dateTime={review.createdAt}>
                  {new Intl.DateTimeFormat(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }).format(new Date(review.createdAt))}
                </time>
              </article>
            ))}
          </div>
          {profile.reviewsHaveMore && (
            <div className="review-load-more">
              {reviewError && (
                <p className="error-banner" role="alert">
                  {reviewError}
                </p>
              )}
              <button
                className="button button-quiet"
                type="button"
                disabled={loadingMoreReviews}
                onClick={loadMoreReviews}
              >
                {loadingMoreReviews ? 'Loading reviews…' : 'Load more reviews'}
              </button>
            </div>
          )}
        </section>
      )}
      <section className="seller-profile-listings">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Currently available</span>
            <h2>Listings by {profile.seller.name.split(' ')[0]}</h2>
          </div>
        </div>
        {profile.properties.length ? (
          <div className="property-grid">
            {profile.properties.map((property) => (
              <PropertyCard key={property._id} property={property} />
            ))}
          </div>
        ) : (
          <p className="empty-state">No active listings right now.</p>
        )}
      </section>
    </section>
  );
}
