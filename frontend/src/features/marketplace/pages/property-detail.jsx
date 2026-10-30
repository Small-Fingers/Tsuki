import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../app/api.js';
import { useAuth } from '../../../app/auth.jsx';
import { usePropertyTools } from '../../../app/property-tools.jsx';
import { availabilityInfo, availabilityLabel } from '../property-info.js';
import { money } from '../../../app/formatters.js';
export function PropertyDetail() {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [reviewData, setReviewData] = useState({
    propertyReviews: [],
    sellerReviews: [],
    propertyRating: null,
    sellerRating: null,
    propertyReviewCount: 0,
    sellerReviewCount: 0,
    propertyHasMore: false,
    sellerHasMore: false,
  });
  const [reviewPages, setReviewPages] = useState({ property: 1, seller: 1 });
  const [loadingMoreReviews, setLoadingMoreReviews] = useState('');
  const [reviewLoadError, setReviewLoadError] = useState('');
  const [reviewEligibility, setReviewEligibility] = useState(null);
  const [reviewTarget, setReviewTarget] = useState('property');
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewComment, setReviewComment] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewTab, setReviewTab] = useState('property');
  const [error, setError] = useState('');
  const auth = useAuth();
  const tools = usePropertyTools();
  const nav = useNavigate();
  const [listingActionMessage, setListingActionMessage] = useState('');
  const [viewingSlots, setViewingSlots] = useState([]);
  const [viewingSlotId, setViewingSlotId] = useState('');
  const [viewingNote, setViewingNote] = useState('');
  const [viewingMessage, setViewingMessage] = useState('');
  const [viewingError, setViewingError] = useState('');
  const [viewingBusy, setViewingBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('misleading');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportMessage, setReportMessage] = useState('');

  useEffect(() => {
    api
      .get(`/api/property/${id}`)
      .then((response) => {
        setProperty(response.data.property);
        setActiveImageIndex(0);
      })
      .catch((requestError) =>
        setError(requestError.response?.data?.message || 'Could not load listing'),
      );
  }, [id]);
  useEffect(() => {
    if (!property?._id || auth?.user?.role !== 'buyer' || property.status !== 'sale') {
      setViewingSlots([]);
      return;
    }
    let active = true;
    api
      .get('/api/viewings/availability', { params: { propertyId: property._id } })
      .then(({ data }) => {
        if (active) {
          setViewingSlots(data.slots);
          setViewingSlotId(data.slots[0]?._id || '');
        }
      })
      .catch(() => {
        if (active) setViewingSlots([]);
      });
    return () => {
      active = false;
    };
  }, [property?._id, property?.status, auth?.user?.role]);

  const refreshReviews = useCallback(
    () =>
      api
        .get(`/api/reviews/property/${id}`)
        .then(({ data }) => {
          setReviewData(data);
          setReviewPages({ property: 1, seller: 1 });
        })
        .catch(() => {}),
    [id],
  );
  useEffect(() => {
    refreshReviews();
  }, [refreshReviews]);
  useEffect(() => {
    if (!auth?.user) {
      setReviewEligibility(null);
      return;
    }
    api
      .get(`/api/reviews/property/${id}/eligibility`)
      .then(({ data }) => setReviewEligibility(data))
      .catch(() => setReviewEligibility(null));
  }, [id, auth?.user]);

  if (error)
    return (
      <section className="page-wrap">
        <p className="error-banner">{error}</p>
        <Link to="/properties">← Back to homes</Link>
      </section>
    );
  if (!property) return <p className="loading">Loading home…</p>;

  const images = property.images || [];
  const activeImage = images[activeImageIndex] || images[0];
  const showImage = (index) => setActiveImageIndex((index + images.length) % images.length);

  const startChat = async () => {
    if (!auth?.user) {
      nav('/login');
      return;
    }
    try {
      const { data } = await api.post('/api/chats/start', {
        propertyId: property._id,
        sellerId: property.seller?._id,
      });
      nav(`/messages/${data.chat._id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not start conversation');
    }
  };

  const saveCurrentHome = async () => {
    if (!auth?.user) {
      nav('/login');
      return;
    }
    const result = await tools.toggleSaved(property._id);
    setListingActionMessage(
      result.success ? '' : result.message || 'Sign in as a buyer to save homes.',
    );
  };
  const compareCurrentHome = () => {
    const result = tools.toggleComparison(property._id);
    setListingActionMessage(result.message || '');
  };
  const requestViewing = async (event) => {
    event.preventDefault();
    if (!auth?.user) {
      nav('/login');
      return;
    }
    setViewingBusy(true);
    setViewingError('');
    setViewingMessage('');
    try {
      const { data } = await api.post('/api/viewings', {
        slotId: viewingSlotId,
        note: viewingNote,
      });
      setViewingMessage(
        `Request sent for ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.viewing.requestedFor))}.`,
      );
      setViewingSlots((current) => current.filter((slot) => slot._id !== viewingSlotId));
      setViewingSlotId('');
      setViewingNote('');
    } catch (requestError) {
      setViewingError(
        requestError.response?.data?.message || 'Could not send the viewing request.',
      );
    } finally {
      setViewingBusy(false);
    }
  };
  const submitReport = async (event) => {
    event.preventDefault();
    setReportBusy(true);
    setReportError('');
    setReportMessage('');
    try {
      const { data } = await api.post(`/api/reports/property/${property._id}`, {
        reason: reportReason,
        details: reportDetails,
      });
      setReportMessage(data.message);
      setReportOpen(false);
      setReportDetails('');
    } catch (requestError) {
      setReportError(requestError.response?.data?.message || 'Could not submit your report.');
    } finally {
      setReportBusy(false);
    }
  };
  const currentHomeSaved = tools.savedIds.includes(String(property._id));
  const currentHomeCompared = tools.comparisonIds.includes(String(property._id));
  const propertyFacts = [
    property.bhk && { label: 'Bedrooms', value: `${property.bhk} BHK` },
    property.bathrooms && { label: 'Bathrooms', value: property.bathrooms },
    property.areaSize && {
      label: 'Built-up area',
      value: `${property.areaSize.toLocaleString()} sq ft`,
    },
    property.furnishing && { label: 'Furnishing', value: property.furnishing.replace('-', ' ') },
  ].filter(Boolean);

  const submitReview = async (event) => {
    event.preventDefault();
    setReviewBusy(true);
    setReviewError('');
    setReviewMessage('');
    try {
      const { data } = await api.post(`/api/reviews/property/${id}`, {
        targetType: reviewTarget,
        rating: Number(reviewRating),
        comment: reviewComment,
      });
      setReviewMessage(data.message);
      setReviewComment(null);
      setReviewEligibility((current) =>
        current
          ? {
              ...current,
              [reviewTarget === 'property' ? 'propertyReview' : 'sellerReview']: data.review,
            }
          : current,
      );
      await refreshReviews();
    } catch (requestError) {
      setReviewError(requestError.response?.data?.message || 'Could not save your review.');
    } finally {
      setReviewBusy(false);
    }
  };

  const visibleReviews =
    reviewTab === 'property' ? reviewData.propertyReviews : reviewData.sellerReviews;
  const visibleRating =
    reviewTab === 'property' ? reviewData.propertyRating : reviewData.sellerRating;
  const visibleReviewCount =
    reviewTab === 'property' ? reviewData.propertyReviewCount : reviewData.sellerReviewCount;
  const hasMoreReviews =
    reviewTab === 'property' ? reviewData.propertyHasMore : reviewData.sellerHasMore;
  const existingReview =
    reviewTarget === 'property'
      ? reviewEligibility?.propertyReview
      : reviewEligibility?.sellerReview;
  const canReview =
    reviewTarget === 'property'
      ? reviewEligibility?.canReviewProperty
      : reviewEligibility?.canReviewSeller;

  const loadMoreReviews = async () => {
    setLoadingMoreReviews(reviewTab);
    setReviewLoadError('');
    const nextPage = reviewPages[reviewTab] + 1;
    try {
      const { data } = await api.get(`/api/reviews/property/${id}`, {
        params: { targetType: reviewTab, page: nextPage },
      });
      const reviewsKey = reviewTab === 'property' ? 'propertyReviews' : 'sellerReviews';
      const hasMoreKey = reviewTab === 'property' ? 'propertyHasMore' : 'sellerHasMore';
      setReviewData((current) => ({
        ...current,
        [reviewsKey]: [...current[reviewsKey], ...data[reviewsKey]],
        [hasMoreKey]: data[hasMoreKey],
      }));
      setReviewPages((current) => ({ ...current, [reviewTab]: nextPage }));
    } catch (requestError) {
      setReviewLoadError(requestError.response?.data?.message || 'Could not load more reviews.');
    } finally {
      setLoadingMoreReviews('');
    }
  };

  return (
    <section className="page-wrap detail-wrap">
      <Link className="text-link" to="/properties">
        ← All homes
      </Link>
      <div className="property-gallery" aria-label="Property photos">
        <div className="detail-image">
          {activeImage ? (
            <img
              src={activeImage}
              alt={`${property.title} — ${activeImageIndex + 1} of ${images.length}`}
            />
          ) : (
            <div className="image-placeholder">⌂</div>
          )}
          {images.length > 1 && (
            <>
              <button
                className="gallery-arrow gallery-previous"
                type="button"
                onClick={() => showImage(activeImageIndex - 1)}
                aria-label="Show previous photo"
              >
                ‹
              </button>
              <button
                className="gallery-arrow gallery-next"
                type="button"
                onClick={() => showImage(activeImageIndex + 1)}
                aria-label="Show next photo"
              >
                ›
              </button>
              <span className="gallery-count" aria-live="polite">
                {activeImageIndex + 1} / {images.length}
              </span>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="gallery-thumbnails" aria-label="Choose a property photo">
            {images.map((image, index) => (
              <button
                className={`gallery-thumbnail${index === activeImageIndex ? ' is-active' : ''}`}
                type="button"
                key={`${image}-${index}`}
                onClick={() => showImage(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-pressed={index === activeImageIndex}
              >
                <img src={image} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="detail-content">
        <div>
          {property.isVerified ? (
            <span
              className="verified-inline"
              title="A Tsuki administrator reviewed this listing. This does not certify the property’s condition."
            >
              <span aria-hidden="true">✓</span> Tsuki reviewed
            </span>
          ) : (
            <span
              className="unverified-inline"
              title="This listing has not yet been reviewed by a Tsuki administrator."
            >
              Not yet reviewed by Tsuki
            </span>
          )}
          <span className="eyebrow">
            {availabilityLabel(property)} · {property.propertyType}
          </span>
          <h1>{property.title}</h1>
          <p className="detail-location">
            <span aria-hidden="true">⌖</span>
            {property.area}, {property.city}
            <span className="detail-location-pin">· {property.pincode}</span>
          </p>
          {availabilityInfo(property).label && (
            <p
              className={`availability-detail-note${availabilityInfo(property).stale ? ' needs-confirmation' : ''}`}
            >
              {availabilityInfo(property).label}
              {availabilityInfo(property).stale
                ? ' — ask the seller to confirm it is still available.'
                : ''}
            </p>
          )}
          <p className="location-precision-note">
            {property.locationPrecision === 'exact'
              ? 'Exact map pin shared by the seller'
              : 'Approximate neighborhood map pin'}
          </p>
          <a className="review-summary" href="#reviews-title">
            {reviewData.propertyRating ? (
              <>
                <span aria-hidden="true">★</span> {reviewData.propertyRating} ·{' '}
                {reviewData.propertyReviews.length} home{' '}
                {reviewData.propertyReviews.length === 1 ? 'review' : 'reviews'}
              </>
            ) : (
              'Be the first to review this home'
            )}{' '}
            <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="detail-purchase">
          <strong className="detail-price">
            {money(property.price)}
            {property.purpose === 'rent' && <small> / month</small>}
          </strong>
          <div className="detail-action-buttons">
            {(!auth?.user || auth.user.role === 'buyer') && (
              <button
                type="button"
                className={`property-action${currentHomeSaved ? ' is-saved' : ''}`}
                aria-pressed={currentHomeSaved}
                onClick={saveCurrentHome}
              >
                {currentHomeSaved ? '♥ Saved' : '♡ Save home'}
              </button>
            )}
            <button
              type="button"
              className={`property-action${currentHomeCompared ? ' is-selected' : ''}`}
              aria-pressed={currentHomeCompared}
              onClick={compareCurrentHome}
            >
              {currentHomeCompared ? 'Added to compare' : 'Compare home'}
            </button>
          </div>
          {listingActionMessage && (
            <span className="property-action-message" role="status">
              {listingActionMessage}
            </span>
          )}
          {auth?.user?.role === 'buyer' &&
            String(property.seller?._id) !== String(auth.user._id) && (
              <div className="listing-report">
                {!reportMessage && (
                  <button
                    className="listing-report-trigger"
                    type="button"
                    aria-expanded={reportOpen}
                    onClick={() => {
                      setReportOpen(!reportOpen);
                      setReportError('');
                    }}
                  >
                    Report this listing
                  </button>
                )}
                {reportOpen && !reportMessage && (
                  <form className="listing-report-form" onSubmit={submitReport}>
                    <label>
                      Reason
                      <select
                        value={reportReason}
                        onChange={(event) => setReportReason(event.target.value)}
                      >
                        <option value="misleading">Details seem misleading</option>
                        <option value="unavailable">Property is unavailable</option>
                        <option value="suspicious">Suspicious or potentially fraudulent</option>
                        <option value="duplicate">Duplicate listing</option>
                        <option value="other">Other concern</option>
                      </select>
                    </label>
                    <label>
                      Additional details <span>(optional)</span>
                      <textarea
                        rows="3"
                        maxLength="1000"
                        value={reportDetails}
                        onChange={(event) => setReportDetails(event.target.value)}
                        placeholder="Tell the review team what you noticed."
                      />
                    </label>
                    {reportError && (
                      <p className="error-banner" role="alert">
                        {reportError}
                      </p>
                    )}
                    <div className="listing-report-actions">
                      <button
                        className="button button-quiet"
                        type="button"
                        onClick={() => setReportOpen(false)}
                      >
                        Cancel
                      </button>
                      <button className="button" disabled={reportBusy}>
                        {reportBusy ? 'Sending…' : 'Send report'}
                      </button>
                    </div>
                  </form>
                )}
                {reportError && !reportOpen && (
                  <p className="error-banner" role="alert">
                    {reportError}
                  </p>
                )}
                {reportMessage && (
                  <p className="success-banner" role="status">
                    {reportMessage}
                  </p>
                )}
              </div>
            )}
          {!auth?.user && (
            <Link className="listing-report-trigger" to="/login">
              Sign in to report this listing
            </Link>
          )}
        </div>
      </div>
      {propertyFacts.length > 0 && (
        <div className="detail-facts" aria-label="Property highlights">
          {propertyFacts.map((fact) => (
            <div className="detail-fact" key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="detail-columns">
        <article>
          <span className="eyebrow detail-section-label">The property</span>
          <h2>Overview</h2>
          <p>{property.description}</p>
          {property.amenities?.length > 0 && (
            <>
              <h2>Features & amenities</h2>
              <div className="amenity-list">
                {property.amenities.map((amenity) => (
                  <span key={amenity}>{amenity}</span>
                ))}
              </div>
            </>
          )}
        </article>
        <aside className="seller-box">
          <span className="eyebrow">Seller</span>
          <div className="seller-person">
            {property.seller?.profilePic ? (
              <img src={property.seller.profilePic} alt="" />
            ) : (
              <span className="seller-initial" aria-hidden="true">
                {property.seller?.name?.charAt(0)?.toUpperCase() || 'H'}
              </span>
            )}
            <div>
              <h3>
                <Link className="seller-profile-link" to={`/sellers/${property.seller?._id}`}>
                  {property.seller?.name || 'Home owner'}
                </Link>
              </h3>
              <span>Listing owner</span>
            </div>
          </div>
          <p className="seller-rating">
            {reviewData.sellerRating ? (
              <>
                <span aria-hidden="true">★</span> {reviewData.sellerRating}{' '}
                <span>
                  · {reviewData.sellerReviews.length} seller{' '}
                  {reviewData.sellerReviews.length === 1 ? 'review' : 'reviews'}
                </span>
              </>
            ) : (
              'No seller reviews yet'
            )}
          </p>
          <p className="muted">Have a question about this home?</p>
          <button className="button" onClick={startChat}>
            Contact seller
          </button>
          {auth?.user?.role === 'buyer' && property.status === 'sale' && (
            <form className="viewing-request" onSubmit={requestViewing}>
              <h4>Request a viewing</h4>
              <label>
                Available time
                <select
                  required
                  value={viewingSlotId}
                  onChange={(event) => setViewingSlotId(event.target.value)}
                >
                  <option value="">Choose an open time</option>
                  {viewingSlots.map((slot) => (
                    <option value={slot._id} key={slot._id}>
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(slot.startsAt))}
                    </option>
                  ))}
                </select>
              </label>
              {viewingSlots.length === 0 && (
                <p className="muted viewing-no-slots">
                  The seller has not posted any open viewing times yet. Contact them to arrange a
                  visit.
                </p>
              )}
              <label>
                Note (optional)
                <textarea
                  rows="3"
                  maxLength="1000"
                  value={viewingNote}
                  onChange={(event) => setViewingNote(event.target.value)}
                  placeholder="Share anything the seller should know"
                />
              </label>
              {viewingError && (
                <p className="error-banner" role="alert">
                  {viewingError}
                </p>
              )}
              {viewingMessage && (
                <p className="success-banner" role="status">
                  {viewingMessage} <Link to="/viewings">View requests</Link>
                </p>
              )}
              <button className="button button-quiet" disabled={viewingBusy || !viewingSlotId}>
                {viewingBusy ? 'Sending…' : 'Request this time'}
              </button>
            </form>
          )}
        </aside>
      </div>
      <section className="reviews-section" aria-labelledby="reviews-title">
        <div className="reviews-heading">
          <div>
            <span className="eyebrow">Experiences shared</span>
            <h2 id="reviews-title">Reviews</h2>
            <p className="muted">
              Only buyers who have messaged about the home or seller can leave a review. Reviews
              reflect personal experiences and are not property inspections.
            </p>
          </div>
          <div className="review-tabs" role="tablist" aria-label="Review type">
            <button
              type="button"
              role="tab"
              aria-selected={reviewTab === 'property'}
              className={reviewTab === 'property' ? 'selected' : ''}
              onClick={() => setReviewTab('property')}
            >
              This home
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={reviewTab === 'seller'}
              className={reviewTab === 'seller' ? 'selected' : ''}
              onClick={() => setReviewTab('seller')}
            >
              Seller
            </button>
          </div>
        </div>
        <div className="review-rating-line">
          <strong>{visibleRating ? `★ ${visibleRating}` : 'No ratings yet'}</strong>
          <span>
            {visibleReviewCount} {visibleReviewCount === 1 ? 'review' : 'reviews'}
          </span>
        </div>
        {visibleReviews.length ? (
          <div className="review-list">
            {visibleReviews.map((review) => (
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
        ) : (
          <p className="empty-reviews">
            No {reviewTab === 'property' ? 'home' : 'seller'} reviews yet.
          </p>
        )}
        {hasMoreReviews && (
          <div className="review-load-more">
            {reviewLoadError && (
              <p className="error-banner" role="alert">
                {reviewLoadError}
              </p>
            )}
            <button
              className="button button-quiet"
              type="button"
              disabled={Boolean(loadingMoreReviews)}
              onClick={loadMoreReviews}
            >
              {loadingMoreReviews ? 'Loading reviews…' : 'Load more reviews'}
            </button>
          </div>
        )}
        {auth?.user?.role === 'buyer' && (
          <form className="review-form" onSubmit={submitReview}>
            <h3>{existingReview ? 'Update your review' : 'Share your experience'}</h3>
            <div className="review-form-grid">
              <label>
                Review
                <select
                  value={reviewTarget}
                  onChange={(event) => {
                    const target = event.target.value;
                    const saved =
                      target === 'property'
                        ? reviewEligibility?.propertyReview
                        : reviewEligibility?.sellerReview;
                    setReviewTarget(target);
                    setReviewRating(String(saved?.rating || 5));
                    setReviewComment(null);
                    setReviewError('');
                    setReviewMessage('');
                  }}
                >
                  <option value="property">This home</option>
                  <option value="seller">The seller</option>
                </select>
              </label>
              <fieldset className="star-rating-field">
                <legend>Your rating</legend>
                <div className="star-rating-options">
                  {[1, 2, 3, 4, 5].map((rating) => {
                    const inputId = `review-rating-${property._id}-${rating}`;
                    return (
                      <span className="star-rating-choice" key={rating}>
                        <input
                          id={inputId}
                          type="radio"
                          name="review-rating"
                          value={rating}
                          checked={Number(reviewRating) === rating}
                          onChange={(event) => setReviewRating(event.target.value)}
                        />
                        <label
                          className={Number(reviewRating) >= rating ? 'is-filled' : ''}
                          htmlFor={inputId}
                          title={`${rating} ${rating === 1 ? 'star' : 'stars'}`}
                        >
                          <span className="sr-only">
                            {rating} {rating === 1 ? 'star' : 'stars'}
                          </span>
                          <span aria-hidden="true">★</span>
                        </label>
                      </span>
                    );
                  })}
                  <output aria-live="polite">{reviewRating} of 5</output>
                </div>
              </fieldset>
            </div>
            <label>
              Your review
              <textarea
                required
                maxLength={1200}
                rows={4}
                value={reviewComment ?? existingReview?.comment ?? ''}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="What would you like others to know?"
              />
            </label>
            {reviewEligibility && !canReview && !existingReview && (
              <p className="muted review-hint">
                Contact the seller about this home before posting a review.
              </p>
            )}
            {reviewError && (
              <p className="error-banner" role="alert">
                {reviewError}
              </p>
            )}
            {reviewMessage && (
              <p className="success-banner" role="status">
                {reviewMessage}
              </p>
            )}
            <button className="button" disabled={reviewBusy || !canReview}>
              {reviewBusy ? 'Saving…' : existingReview ? 'Update review' : 'Post review'}
            </button>
          </form>
        )}
        {!auth?.user && (
          <p className="review-sign-in">
            <Link to="/login">Sign in</Link> as a buyer to leave a review after contacting the
            seller.
          </p>
        )}
      </section>
    </section>
  );
}
