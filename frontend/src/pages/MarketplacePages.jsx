import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import heroImage from '../assets/hero-apartment.jpg';
import { api, PROPERTY_COLLECTIONS, useAuth, usePropertyTools, useNotifications, money, localDateKey, availabilityInfo, availabilityLabel, watchChatUpdates, usePrefersReducedMotion } from '../app/shared.jsx';

function PropertyCard({ property, autoRotate = false, rotationDelay = 0 }) {
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
    property.propertyReviewSummary?.count > 0 && `home rating ${property.propertyReviewSummary.rating} from ${property.propertyReviewSummary.count} buyer reviews`,
    property.sellerReviewSummary?.count > 0 && `seller rating ${property.sellerReviewSummary.rating} from ${property.sellerReviewSummary.count} buyer reviews`,
  ].filter(Boolean).join(', ');

  useEffect(() => {
    setImageIndex(0);
    if (!autoRotate || images.length < 2 || reducedMotion) return undefined;
    let interval;
    const timeout = window.setTimeout(() => {
      setImageIndex((current) => (current + 1) % images.length);
      interval = window.setInterval(() => setImageIndex((current) => (current + 1) % images.length), 5000);
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
    if (!auth?.user) { navigate('/login'); return; }
    const result = await tools.toggleSaved(property._id);
    if (!result.success) setActionMessage(result.message || 'Sign in as a buyer to save homes.');
  };
  const compareProperty = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const result = tools.toggleComparison(property._id);
    setActionMessage(result.message || '');
  };

  return <article className="property-card">
    <Link className="property-card-main" to={`/properties/${property._id}`} aria-label={`${property.title}, ${money(property.price)}${property.purpose === 'rent' ? ' per month' : ''}, ${trustLabel}`}>
      <div className="property-image">{images[imageIndex] ? <img key={images[imageIndex]} className={autoRotate ? 'auto-rotating-photo' : ''} src={images[imageIndex]} alt={`${property.title}${images.length > 1 ? ` — photo ${imageIndex + 1} of ${images.length}` : ''}`} loading="lazy" /> : <div className="image-placeholder">⌂</div>}{autoRotate && images.length > 1 && <span className="card-photo-count" aria-hidden="true">0{imageIndex + 1} / 0{images.length}</span>}<span className={`tag ${property.status === 'sold' || property.status === 'rented' || property.status === 'unavailable' ? 'tag-sold' : property.purpose === 'rent' ? 'tag-rent' : 'tag-sale'}`}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 7.2 8 2l6 5.2v6.3H2z" /></svg>{availabilityLabel(property)}</span>{property.isVerified && <span className="verified-mark" title="A Tsuki administrator reviewed this listing. This does not certify the property’s condition."><span aria-hidden="true">✓</span> Verified</span>}<span className="property-open" aria-hidden="true">↗</span></div>
      <div className="property-info"><div className="property-price-line"><span className="price">{money(property.price)}</span>{property.purpose === 'rent' && <span className="price-period">/ month</span>}</div><h3>{property.title}</h3><p className="property-location"><span aria-hidden="true">⌖</span> {property.area}, {property.city}</p><div className="property-trust" aria-label="Listing freshness, review and buyer feedback">{availabilityInfo(property).label && <span className={`availability-freshness${availabilityInfo(property).stale ? ' needs-confirmation' : ''}`}>{availabilityInfo(property).label}</span>}{!property.isVerified && <span className="card-review-pending" title="This listing has not yet been reviewed by a Tsuki administrator.">Review pending</span>}{property.propertyReviewSummary?.count > 0 && <span aria-label={`Home rating ${property.propertyReviewSummary.rating} out of 5 from ${property.propertyReviewSummary.count} buyer reviews`}>★ {property.propertyReviewSummary.rating} <small>home · {property.propertyReviewSummary.count}</small></span>}{property.sellerReviewSummary?.count > 0 && <span aria-label={`Seller rating ${property.sellerReviewSummary.rating} out of 5 from ${property.sellerReviewSummary.count} buyer reviews`}>★ {property.sellerReviewSummary.rating} <small>seller · {property.sellerReviewSummary.count}</small></span>}</div><div className="property-meta"><span>{property.bhk ? `${property.bhk} BHK` : property.propertyType}</span>{property.areaSize ? <span>{property.areaSize.toLocaleString()} sq ft</span> : null}{property.bathrooms ? <span>{property.bathrooms} bath</span> : null}</div></div>
    </Link>
    <div className="property-card-actions">{(!auth?.user || auth.user.role === 'buyer') && <button type="button" className={`property-action${saved ? ' is-saved' : ''}`} onClick={saveProperty} aria-pressed={saved} aria-label={saved ? `Remove ${property.title} from saved homes` : `Save ${property.title}`}><span aria-hidden="true">{saved ? '♥' : '♡'}</span>{saved ? 'Saved' : 'Save'}</button>}<button type="button" className={`property-action${selected ? ' is-selected' : ''}`} onClick={compareProperty} aria-pressed={selected} aria-label={selected ? `Remove ${property.title} from comparison` : `Add ${property.title} to comparison`}>{selected ? 'Added to compare' : 'Compare'}</button></div>
    {actionMessage && <p className="property-action-message" role="status">{actionMessage}</p>}
  </article>;
}
function PropertyCollectionCard({ item, properties }) {
  const photos = [...new Map(properties
    .filter((property) => item.matches.includes(String(property.propertyType).toLowerCase()))
    .flatMap((property) => (property.images || []).filter(Boolean).map((src) => [src, { src, title: property.title }]))).values()];
  const photoKey = photos.map((photo) => photo.src).join('|');
  const [imageIndex, setImageIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!photos.length) { setImageIndex(0); return undefined; }
    const startingIndex = Math.floor(Math.random() * photos.length);
    setImageIndex(startingIndex);
    if (photos.length < 2 || reducedMotion) return undefined;
    let timeout;
    let active = true;
    const rotate = () => {
      timeout = window.setTimeout(() => {
        if (!active) return;
        setImageIndex((current) => {
          const offset = 1 + Math.floor(Math.random() * (photos.length - 1));
          return ((current % photos.length) + offset) % photos.length;
        });
        rotate();
      }, 12000 + Math.floor(Math.random() * 6000));
    };
    rotate();
    return () => { active = false; window.clearTimeout(timeout); };
  }, [photoKey, reducedMotion]);

  const currentPhoto = photos[imageIndex];
  return <Link className={`collection-card${currentPhoto ? '' : ' collection-card-empty'}`} to={`/properties?propertyType=${item.type}`}>
    {currentPhoto ? <img key={currentPhoto.src} src={currentPhoto.src} alt={`${item.title} listing: ${currentPhoto.title}`} loading="lazy"/> : <span className="collection-no-photo" aria-hidden="true">New listings welcome</span>}
    <span className="collection-shade"/><span className="collection-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span><span className="collection-arrow" aria-hidden="true">↗</span>
  </Link>;
}
export function Home() {
  const auth = useAuth();
  const [properties, setProperties] = useState([]);
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [purpose, setPurpose] = useState('sale');
  const [budget, setBudget] = useState('');
  const [featuredPage, setFeaturedPage] = useState(0);
  const [collectionProperties, setCollectionProperties] = useState({});
  const navigate = useNavigate();
  useEffect(() => { api.get('/api/property', { params: { pageSize: 6 } }).then((response) => setProperties(response.data.properties)).catch(() => {}); }, []);
  useEffect(() => {
    let active = true;
    Promise.allSettled(PROPERTY_COLLECTIONS.map((item) => api.get('/api/property', { params: { propertyType: item.type, pageSize: 24 } }))).then((results) => {
      if (!active) return;
      setCollectionProperties(Object.fromEntries(results.flatMap((result, index) => result.status === 'fulfilled' ? [[PROPERTY_COLLECTIONS[index].type, result.value.data.properties]] : [])));
    });
    return () => { active = false; };
  }, []);
  const featuredPages = Math.ceil(properties.length / 3);
  const featuredListings = properties.slice(featuredPage * 3, featuredPage * 3 + 3);
  const search = (event) => {
    event.preventDefault();
    const params = new URLSearchParams({ purpose });
    if (city.trim()) params.set('city', city.trim());
    if (type) params.set('propertyType', type);
    if (budget) {
      const [minPrice, maxPrice] = budget.split('-');
      if (minPrice && minPrice !== '0') params.set('minPrice', minPrice);
      if (maxPrice && maxPrice !== '0') params.set('maxPrice', maxPrice);
    }
    navigate(`/properties?${params}`);
  };
  return <div className="home-page">
    <section className="home-hero">
      <div className="home-hero-image"><img src={heroImage} alt="Apartment living room with warm timber details and a balcony view" fetchPriority="high" /></div>
      <div className="home-hero-shade" />
      <div className="home-hero-copy"><span className="eyebrow">Search homes to buy or rent</span><h1>Find a place<br />that feels like <em>yours.</em></h1><p>Search by location, budget and property type. Save favorites, compare homes and speak directly with sellers.</p><Link className="hero-cta" to="/properties">Explore properties <span aria-hidden="true">↗</span></Link></div>
      <form className="home-search" onSubmit={search} aria-label="Search properties">
        <div className="purpose-switch" role="group" aria-label="Buy or rent"><button type="button" className={purpose === 'sale' ? 'selected' : ''} aria-pressed={purpose === 'sale'} onClick={() => { setPurpose('sale'); setBudget(''); }}>Buy</button><button type="button" className={purpose === 'rent' ? 'selected' : ''} aria-pressed={purpose === 'rent'} onClick={() => { setPurpose('rent'); setBudget(''); }}>Rent</button></div>
        <label className="home-search-field"><span>Location</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City or neighbourhood" /></label>
        <label className="home-search-field"><span>Property type</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="">Any type</option><option value="apartment">Apartment</option><option value="villa">Villa</option><option value="house">House</option><option value="commercial">Commercial</option><option value="plot">Plot</option></select></label>
        <label className="home-search-field"><span>Price range</span><select value={budget} onChange={(event) => setBudget(event.target.value)}><option value="">Any budget</option>{purpose === 'sale' ? <><option value="0-5000000">Under ₹50 lakh</option><option value="5000000-10000000">₹50 lakh – ₹1 crore</option><option value="10000000-50000000">₹1 – ₹5 crore</option><option value="50000000-0">Above ₹5 crore</option></> : <><option value="0-25000">Under ₹25,000 / month</option><option value="25000-50000">₹25,000 – ₹50,000 / month</option><option value="50000-100000">₹50,000 – ₹1 lakh / month</option><option value="100000-0">Above ₹1 lakh / month</option></>}</select></label>
        <button className="search-submit" type="submit" aria-label="Search homes"><span>Search homes</span><b aria-hidden="true">↗</b></button>
      </form>
    </section>

    <section className="home-section home-collections"><div className="section-heading"><div><span className="eyebrow">Browse current listings</span><h2>Find homes by type.</h2></div><p>Explore available apartments, houses, villas and commercial spaces.</p></div><div className="collection-grid">{PROPERTY_COLLECTIONS.map((item) => <PropertyCollectionCard key={item.type} item={item} properties={collectionProperties[item.type] || []}/>)}</div></section>

    <section className="home-section home-featured" aria-label="Latest listings"><div className="section-heading"><div><h2>Latest listings</h2></div><div className="featured-actions"><Link className="section-link" to="/properties">View all properties <span aria-hidden="true">↗</span></Link>{featuredPages > 1 && <div className="featured-controls" aria-label="Featured listing pages"><button type="button" className="featured-arrow" aria-label="Show previous homes" onClick={() => setFeaturedPage((page) => (page - 1 + featuredPages) % featuredPages)}>←</button><span aria-live="polite">{String(featuredPage + 1).padStart(2, '0')} / {String(featuredPages).padStart(2, '0')}</span><button type="button" className="featured-arrow" aria-label="Show more homes" onClick={() => setFeaturedPage((page) => (page + 1) % featuredPages)}>→</button></div>}</div></div>{properties.length ? <div className="property-grid" key={featuredPage}>{featuredListings.map((property, index) => <PropertyCard key={property._id} property={property} autoRotate rotationDelay={index * 1700}/>)}</div> : <div className="empty-state">No published listings yet.</div>}</section>

    <section className="home-values"><div className="values-heading"><span className="eyebrow">A practical path to a home</span><h2>Search.<br />Compare.<br />Connect.</h2></div><div className="values-list"><article><div><h3>Search your way</h3><p>Filter by location, budget, property type and buy or rent. Switch between list and map views to explore matching listings.</p></div></article><article><div><h3>Build a shortlist</h3><p>Save favorite homes, compare up to four listings side by side, and save searches to revisit matching properties.</p></div></article><article><div><h3>Talk with context</h3><p>Message sellers, request a viewing, and read reviews from buyers who have contacted the seller. Flag a listing if something seems wrong.</p></div></article></div></section>

    {(!auth?.user || auth.user.role === 'seller') && <section className="home-owner-cta"><div><span className="eyebrow">For property owners</span><h2>Have a property to list?</h2><p>Add photos, pricing, location and property details. Manage conversations and viewing requests from your seller studio.</p><Link className="hero-cta" to={auth?.user?.role === 'seller' ? '/new-listing' : '/register'}>List your property <span aria-hidden="true">↗</span></Link></div><span className="owner-mark" aria-hidden="true">T.</span></section>}
  </div>;
}
export function Properties() {
  const auth = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    city: searchParams.get('city') || '',
    propertyType: searchParams.get('propertyType') || '',
    purpose: searchParams.get('purpose') || '',
    bhk: searchParams.get('bhk') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    sort: 'latest',
  });
  const [listings, setListings] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertError, setAlertError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
      api.get('/api/property', { params: { ...params, page, pageSize: 12 } })
        .then(({ data }) => { setListings(data.properties); setPagination(data); setError(''); })
        .catch(() => setError('Could not load properties. Check that the API is running.'))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [filters, page]);

  const update = (key, value) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };
  const clear = () => { setPage(1); setFilters({ city: '', propertyType: '', purpose: '', bhk: '', minPrice: '', maxPrice: '', sort: 'latest' }); };
  const activeFilters = [
    filters.city && { key: 'city', label: filters.city },
    filters.propertyType && { key: 'propertyType', label: filters.propertyType },
    filters.purpose && { key: 'purpose', label: filters.purpose === 'rent' ? 'For rent' : 'For sale' },
    filters.bhk && { key: 'bhk', label: `${filters.bhk} BHK` },
    filters.minPrice && { key: 'minPrice', label: `From ${money(filters.minPrice)}` },
    filters.maxPrice && { key: 'maxPrice', label: `Up to ${money(filters.maxPrice)}` },
  ].filter(Boolean);
  const saveSearch = async () => {
    if (auth?.user?.role !== 'buyer') { nav('/login'); return; }
    setAlertMessage(''); setAlertError(false);
    try {
      const searchFilters = Object.fromEntries(Object.entries(filters).filter(([key, value]) => key !== 'sort' && value));
      await api.post('/api/search-alerts', { filters: searchFilters });
      setAlertMessage('Search saved. New matching listings will appear in Search alerts.');
    } catch (requestError) { setAlertError(true); setAlertMessage(requestError.response?.data?.message || 'Could not save this search.'); }
  };

  return <section className="page-wrap">
    <div className="page-intro"><span className="eyebrow">The Tsuki collection</span><h1>Homes with<br/><em>character.</em></h1><p>Explore places to buy or rent, and narrow the search to what suits you.</p></div>
    <div className="filters">
      <label>Buy or rent<select value={filters.purpose} onChange={(e) => update('purpose', e.target.value)}><option value="">Buy and rent</option><option value="sale">For sale</option><option value="rent">For rent</option></select></label>
      <label>Location<input aria-label="Filter by city or area" value={filters.city} onChange={(e) => update('city', e.target.value)} placeholder="City or area"/></label>
      <label>Property type<select value={filters.propertyType} onChange={(e) => update('propertyType', e.target.value)}><option value="">All types</option><option value="flat">Apartment</option><option value="villa">Villa</option><option value="house">House</option><option value="commercial">Commercial</option><option value="plot">Plot</option></select></label>
      <label>Bedrooms<select value={filters.bhk} onChange={(e) => update('bhk', e.target.value)}><option value="">Any</option>{['1','2','3','4','5+'].map((n) => <option key={n} value={n}>{n} BHK</option>)}</select></label>
      <label>Minimum price<input type="number" min="0" step="100000" value={filters.minPrice} onChange={(e) => update('minPrice', e.target.value)} placeholder="No minimum"/></label>
      <label className="max-price-filter">Maximum price <span>{filters.maxPrice ? money(filters.maxPrice) : 'Any price'}</span><input aria-label="Maximum price" type="range" min="100000" max="100000000" step="500000" value={filters.maxPrice || 100000000} onChange={(e) => update('maxPrice', e.target.value)}/></label>
      <label>Sort by<select value={filters.sort} onChange={(e) => update('sort', e.target.value)}><option value="latest">Recently added</option><option value="priceLow">Price: low to high</option><option value="priceHigh">Price: high to low</option></select></label>
      <button className="button button-quiet" type="button" onClick={clear}>Reset filters</button>
    </div>
    <div className="active-filters" aria-label="Active search filters">{activeFilters.map((filter) => <span className="filter-chip" key={filter.key}>{filter.label}<button type="button" aria-label={`Remove ${filter.label} filter`} onClick={() => update(filter.key, '')}>×</button></span>)}</div>
    <div className="results-heading"><span aria-live="polite">{loading ? 'Searching…' : `${pagination.total} ${pagination.total === 1 ? 'property' : 'properties'}`}</span><div className="results-actions"><span>{filters.purpose === 'rent' ? 'For rent' : filters.purpose === 'sale' ? 'For sale' : 'For sale or rent'}</span><div className="view-toggle" role="group" aria-label="Search result view"><button type="button" className={viewMode === 'list' ? 'selected' : ''} aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}>List</button><button type="button" className={viewMode === 'map' ? 'selected' : ''} aria-pressed={viewMode === 'map'} onClick={() => setViewMode('map')}>Map</button></div>{auth?.user?.role === 'buyer' && <button type="button" className="text-link save-search-button" onClick={saveSearch}>Save search ♧</button>}</div></div>
    {alertMessage && <p className={alertError ? 'error-banner' : 'success-banner'} role={alertError ? 'alert' : 'status'}>{alertMessage}</p>}
    {error && <p className="error-banner" role="alert">{error}</p>}
    {loading ? <p className="loading" role="status">Finding available homes…</p> : listings.length ? viewMode === 'map' ? <PropertyMap properties={listings}/> : <div className="property-grid">{listings.map((property) => <PropertyCard key={property._id} property={property}/>)}</div> : <div className="empty-state">No homes match these filters. Adjust your search or reset the filters.</div>}
    {!loading && pagination.totalPages > 1 && <nav className="pagination" aria-label="Property pages"><button className="button button-quiet" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pagination.totalPages}</span><button className="button button-quiet" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}
  </section>;
}

function PropertyMap({ properties }) {
  const [geocoded, setGeocoded] = useState({});
  const [locating, setLocating] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const propertyKey = properties.map((property) => property._id).join(',');
  useEffect(() => {
    let active = true;
    const locate = async () => {
      const missing = properties.filter((property) => property.latitude == null || property.longitude == null);
      if (!missing.length) return;
      setLocating(true);
      let lastLookup = 0;
      for (const property of missing) {
        if (!active) break;
        const place = [property.area, property.city, property.pincode, 'India'].filter(Boolean).join(', ');
        const cacheKey = `tsuki-map:${place.toLowerCase()}`;
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
          if (Array.isArray(cached)) { if (cached.length === 2) setGeocoded((current) => ({ ...current, [property._id]: cached })); continue; }
          const wait = Math.max(0, 1100 - (Date.now() - lastLookup));
          if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
          lastLookup = Date.now();
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(place)}`, { headers: { Accept: 'application/json' } });
          if (!response.ok) continue;
          const results = await response.json();
          const coords = results[0] ? [Number(results[0].lat), Number(results[0].lon)] : [];
          try { localStorage.setItem(cacheKey, JSON.stringify(coords)); } catch { /* The map can still use this result for this visit. */ }
          if (coords.length === 2 && coords.every(Number.isFinite)) setGeocoded((current) => ({ ...current, [property._id]: coords }));
        } catch { /* Map still lists homes without a resolvable address. */ }
      }
      if (active) setLocating(false);
    };
    locate();
    return () => { active = false; };
  }, [propertyKey]);
  const mapped = properties.flatMap((property) => {
    const coords = property.latitude != null && property.longitude != null ? [Number(property.latitude), Number(property.longitude)] : geocoded[property._id];
    return coords?.length === 2 && coords.every(Number.isFinite) ? [{ ...property, latitude: coords[0], longitude: coords[1] }] : [];
  });
  useEffect(() => {
    if (selectedPropertyId && !mapped.some((property) => String(property._id) === selectedPropertyId)) setSelectedPropertyId('');
  }, [propertyKey, selectedPropertyId, geocoded]);
  if (!mapped.length) return <div className="empty-state map-empty"><h2>{locating ? 'Locating these homes…' : 'No map pins for these homes'}</h2><p>{locating ? 'Looking up the listing areas on OpenStreetMap.' : 'Try the map again later or refine the search location.'}</p></div>;
  const latitudes = mapped.map((property) => Number(property.latitude));
  const longitudes = mapped.map((property) => Number(property.longitude));
  const latSpan = Math.max(Math.max(...latitudes) - Math.min(...latitudes), 0.012);
  const lonSpan = Math.max(Math.max(...longitudes) - Math.min(...longitudes), 0.012);
  const south = Math.max(-85, Math.min(...latitudes) - latSpan * .25);
  const north = Math.min(85, Math.max(...latitudes) + latSpan * .25);
  const west = Math.max(-180, Math.min(...longitudes) - lonSpan * .25);
  const east = Math.min(180, Math.max(...longitudes) + lonSpan * .25);
  const bbox = `${west},${south},${east},${north}`;
  const selectedProperty = mapped.find((property) => String(property._id) === selectedPropertyId);
  return <div className="property-map-layout"><div className="property-map"><iframe title="Map of matching property locations" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`}/><div className="map-pins">{mapped.map((property, index) => <button key={property._id} type="button" className={`map-pin${String(property._id) === selectedPropertyId ? ' is-selected' : ''}`} style={{ left: `${((Number(property.longitude) - west) / (east - west)) * 100}%`, top: `${(1 - (Number(property.latitude) - south) / (north - south)) * 100}%` }} title={`Select ${property.title}`} aria-label={`Select ${property.title} on map`} aria-pressed={String(property._id) === selectedPropertyId} onMouseEnter={() => setSelectedPropertyId(String(property._id))} onFocus={() => setSelectedPropertyId(String(property._id))} onClick={() => setSelectedPropertyId(String(property._id))}>{index + 1}</button>)}</div></div><div className="map-result-list">{mapped.map((property, index) => <article className={`map-result${String(property._id) === selectedPropertyId ? ' is-selected' : ''}`} key={property._id}><button type="button" aria-label={`Highlight ${property.title} on map`} aria-pressed={String(property._id) === selectedPropertyId} onMouseEnter={() => setSelectedPropertyId(String(property._id))} onFocus={() => setSelectedPropertyId(String(property._id))} onClick={() => setSelectedPropertyId(String(property._id))}>{index + 1}</button><Link to={`/properties/${property._id}`} onMouseEnter={() => setSelectedPropertyId(String(property._id))} onFocus={() => setSelectedPropertyId(String(property._id))}><strong>{property.title}</strong><small>{property.area}, {property.city} · {money(property.price)}{property.purpose === 'rent' ? ' / month' : ''}</small></Link></article>)}{mapped.length < properties.length && <p className="muted">{properties.length - mapped.length} {properties.length - mapped.length === 1 ? 'listing has' : 'listings have'} no map pin yet.</p>}<small className="map-attribution">Map data © OpenStreetMap contributors</small></div><p className="sr-only" aria-live="polite">{selectedProperty ? `Selected ${selectedProperty.title} on the map.` : ''}</p></div>;
}

export function PropertyDetail() {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [reviewData, setReviewData] = useState({ propertyReviews: [], sellerReviews: [], propertyRating: null, sellerRating: null });
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
    api.get(`/api/property/${id}`)
      .then((response) => {
        setProperty(response.data.property);
        setActiveImageIndex(0);
      })
      .catch((requestError) => setError(requestError.response?.data?.message || 'Could not load listing'));
  }, [id]);
  useEffect(() => {
    if (!property?._id || auth?.user?.role !== 'buyer' || property.status !== 'sale') { setViewingSlots([]); return; }
    let active = true;
    api.get('/api/viewings/availability', { params: { propertyId: property._id } })
      .then(({ data }) => { if (active) { setViewingSlots(data.slots); setViewingSlotId(data.slots[0]?._id || ''); } })
      .catch(() => { if (active) setViewingSlots([]); });
    return () => { active = false; };
  }, [property?._id, property?.status, auth?.user?.role]);

  const refreshReviews = () => api.get(`/api/reviews/property/${id}`).then(({ data }) => setReviewData(data)).catch(() => {});
  useEffect(() => { refreshReviews(); }, [id]);
  useEffect(() => {
    if (!auth?.user) { setReviewEligibility(null); return; }
    api.get(`/api/reviews/property/${id}/eligibility`).then(({ data }) => setReviewEligibility(data)).catch(() => setReviewEligibility(null));
  }, [id, auth?.user?._id]);

  if (error) return <section className="page-wrap"><p className="error-banner">{error}</p><Link to="/properties">← Back to homes</Link></section>;
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
      const { data } = await api.post('/api/chats/start', { propertyId: property._id, sellerId: property.seller?._id });
      nav(`/messages/${data.chat._id}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not start conversation');
    }
  };

  const saveCurrentHome = async () => {
    if (!auth?.user) { nav('/login'); return; }
    const result = await tools.toggleSaved(property._id);
    setListingActionMessage(result.success ? '' : result.message || 'Sign in as a buyer to save homes.');
  };
  const compareCurrentHome = () => {
    const result = tools.toggleComparison(property._id);
    setListingActionMessage(result.message || '');
  };
  const requestViewing = async (event) => {
    event.preventDefault();
    if (!auth?.user) { nav('/login'); return; }
    setViewingBusy(true); setViewingError(''); setViewingMessage('');
    try {
      const { data } = await api.post('/api/viewings', { slotId: viewingSlotId, note: viewingNote });
      setViewingMessage(`Request sent for ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.viewing.requestedFor))}.`);
      setViewingSlots((current) => current.filter((slot) => slot._id !== viewingSlotId)); setViewingSlotId(''); setViewingNote('');
    } catch (requestError) { setViewingError(requestError.response?.data?.message || 'Could not send the viewing request.'); }
    finally { setViewingBusy(false); }
  };
  const submitReport = async (event) => {
    event.preventDefault();
    setReportBusy(true); setReportError(''); setReportMessage('');
    try {
      const { data } = await api.post(`/api/reports/property/${property._id}`, { reason: reportReason, details: reportDetails });
      setReportMessage(data.message);
      setReportOpen(false);
      setReportDetails('');
    } catch (requestError) { setReportError(requestError.response?.data?.message || 'Could not submit your report.'); }
    finally { setReportBusy(false); }
  };
  const currentHomeSaved = tools.savedIds.includes(String(property._id));
  const currentHomeCompared = tools.comparisonIds.includes(String(property._id));
  const propertyFacts = [
    property.bhk && { label: 'Bedrooms', value: `${property.bhk} BHK` },
    property.bathrooms && { label: 'Bathrooms', value: property.bathrooms },
    property.areaSize && { label: 'Built-up area', value: `${property.areaSize.toLocaleString()} sq ft` },
    property.furnishing && { label: 'Furnishing', value: property.furnishing.replace('-', ' ') },
  ].filter(Boolean);

  const submitReview = async (event) => {
    event.preventDefault();
    setReviewBusy(true);
    setReviewError('');
    setReviewMessage('');
    try {
      const { data } = await api.post(`/api/reviews/property/${id}`, { targetType: reviewTarget, rating: Number(reviewRating), comment: reviewComment });
      setReviewMessage(data.message);
      setReviewComment(null);
      setReviewEligibility((current) => current ? { ...current, [reviewTarget === 'property' ? 'propertyReview' : 'sellerReview']: data.review } : current);
      await refreshReviews();
    } catch (requestError) {
      setReviewError(requestError.response?.data?.message || 'Could not save your review.');
    } finally { setReviewBusy(false); }
  };

  const visibleReviews = reviewTab === 'property' ? reviewData.propertyReviews : reviewData.sellerReviews;
  const visibleRating = reviewTab === 'property' ? reviewData.propertyRating : reviewData.sellerRating;
  const existingReview = reviewTarget === 'property' ? reviewEligibility?.propertyReview : reviewEligibility?.sellerReview;
  const canReview = reviewTarget === 'property' ? reviewEligibility?.canReviewProperty : reviewEligibility?.canReviewSeller;

  return <section className="page-wrap detail-wrap">
    <Link className="text-link" to="/properties">← All homes</Link>
    <div className="property-gallery" aria-label="Property photos">
      <div className="detail-image">
        {activeImage ? <img src={activeImage} alt={`${property.title} — photo ${activeImageIndex + 1} of ${images.length}`} /> : <div className="image-placeholder">⌂</div>}
        {images.length > 1 && <>
          <button className="gallery-arrow gallery-previous" type="button" onClick={() => showImage(activeImageIndex - 1)} aria-label="Show previous photo">‹</button>
          <button className="gallery-arrow gallery-next" type="button" onClick={() => showImage(activeImageIndex + 1)} aria-label="Show next photo">›</button>
          <span className="gallery-count" aria-live="polite">{activeImageIndex + 1} / {images.length}</span>
        </>}
      </div>
      {images.length > 1 && <div className="gallery-thumbnails" aria-label="Choose a property photo">
        {images.map((image, index) => <button className={`gallery-thumbnail${index === activeImageIndex ? ' is-active' : ''}`} type="button" key={`${image}-${index}`} onClick={() => showImage(index)} aria-label={`Show photo ${index + 1}`} aria-pressed={index === activeImageIndex}>
          <img src={image} alt="" loading="lazy" />
        </button>)}
      </div>}
    </div>
    <div className="detail-content">
      <div>
        {property.isVerified ? <span className="verified-inline" title="A Tsuki administrator reviewed this listing. This does not certify the property’s condition."><span aria-hidden="true">✓</span> Tsuki reviewed</span> : <span className="unverified-inline" title="This listing has not yet been reviewed by a Tsuki administrator.">Not yet reviewed by Tsuki</span>}
        <span className="eyebrow">{availabilityLabel(property)} · {property.propertyType}</span>
        <h1>{property.title}</h1>
        <p className="detail-location"><span aria-hidden="true">⌖</span>{property.area}, {property.city}<span className="detail-location-pin">· {property.pincode}</span></p>
        {availabilityInfo(property).label && <p className={`availability-detail-note${availabilityInfo(property).stale ? ' needs-confirmation' : ''}`}>{availabilityInfo(property).label}{availabilityInfo(property).stale ? ' — ask the seller to confirm it is still available.' : ''}</p>}
        <p className="location-precision-note">{property.locationPrecision === 'exact' ? 'Exact map pin shared by the seller' : 'Approximate neighborhood map pin'}</p>
        <a className="review-summary" href="#reviews-title">{reviewData.propertyRating ? <><span aria-hidden="true">★</span> {reviewData.propertyRating} · {reviewData.propertyReviews.length} home {reviewData.propertyReviews.length === 1 ? 'review' : 'reviews'}</> : 'Be the first to review this home'} <span aria-hidden="true">↓</span></a>
      </div>
      <div className="detail-purchase"><strong className="detail-price">{money(property.price)}{property.purpose === 'rent' && <small> / month</small>}</strong><div className="detail-action-buttons">{(!auth?.user || auth.user.role === 'buyer') && <button type="button" className={`property-action${currentHomeSaved ? ' is-saved' : ''}`} aria-pressed={currentHomeSaved} onClick={saveCurrentHome}>{currentHomeSaved ? '♥ Saved' : '♡ Save home'}</button>}<button type="button" className={`property-action${currentHomeCompared ? ' is-selected' : ''}`} aria-pressed={currentHomeCompared} onClick={compareCurrentHome}>{currentHomeCompared ? 'Added to compare' : 'Compare home'}</button></div>{listingActionMessage && <span className="property-action-message" role="status">{listingActionMessage}</span>}{auth?.user?.role === 'buyer' && String(property.seller?._id) !== String(auth.user._id) && <div className="listing-report">{!reportMessage && <button className="listing-report-trigger" type="button" aria-expanded={reportOpen} onClick={() => { setReportOpen(!reportOpen); setReportError(''); }}>Report this listing</button>}{reportOpen && !reportMessage && <form className="listing-report-form" onSubmit={submitReport}><label>Reason<select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option value="misleading">Details seem misleading</option><option value="unavailable">Property is unavailable</option><option value="suspicious">Suspicious or potentially fraudulent</option><option value="duplicate">Duplicate listing</option><option value="other">Other concern</option></select></label><label>Additional details <span>(optional)</span><textarea rows="3" maxLength="1000" value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Tell the review team what you noticed." /></label>{reportError && <p className="error-banner" role="alert">{reportError}</p>}<div className="listing-report-actions"><button className="button button-quiet" type="button" onClick={() => setReportOpen(false)}>Cancel</button><button className="button" disabled={reportBusy}>{reportBusy ? 'Sending…' : 'Send report'}</button></div></form>}{reportError && !reportOpen && <p className="error-banner" role="alert">{reportError}</p>}{reportMessage && <p className="success-banner" role="status">{reportMessage}</p>}</div>}{!auth?.user && <Link className="listing-report-trigger" to="/login">Sign in to report this listing</Link>}</div>
    </div>
    {propertyFacts.length > 0 && <div className="detail-facts" aria-label="Property highlights">{propertyFacts.map((fact) => <div className="detail-fact" key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></div>)}</div>}
    <div className="detail-columns">
      <article>
        <span className="eyebrow detail-section-label">The property</span><h2>Overview</h2>
        <p>{property.description}</p>
        {property.amenities?.length > 0 && <><h2>Features & amenities</h2><div className="amenity-list">{property.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div></>}
      </article>
      <aside className="seller-box">
        <span className="eyebrow">Seller</span>
        <div className="seller-person">{property.seller?.profilePic ? <img src={property.seller.profilePic} alt=""/> : <span className="seller-initial" aria-hidden="true">{property.seller?.name?.charAt(0)?.toUpperCase() || 'H'}</span>}<div><h3><Link className="seller-profile-link" to={`/sellers/${property.seller?._id}`}>{property.seller?.name || 'Home owner'}</Link></h3><span>Listing owner</span></div></div>
        <p className="seller-rating">{reviewData.sellerRating ? <><span aria-hidden="true">★</span> {reviewData.sellerRating} <span>· {reviewData.sellerReviews.length} seller {reviewData.sellerReviews.length === 1 ? 'review' : 'reviews'}</span></> : 'No seller reviews yet'}</p>
        <p className="muted">Have a question about this home?</p>
        <button className="button" onClick={startChat}>Contact seller</button>
        {auth?.user?.role === 'buyer' && property.status === 'sale' && <form className="viewing-request" onSubmit={requestViewing}><h4>Request a viewing</h4><label>Available time<select required value={viewingSlotId} onChange={(event) => setViewingSlotId(event.target.value)}><option value="">Choose an open time</option>{viewingSlots.map((slot) => <option value={slot._id} key={slot._id}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(slot.startsAt))}</option>)}</select></label>{viewingSlots.length === 0 && <p className="muted viewing-no-slots">The seller has not posted any open viewing times yet. Contact them to arrange a visit.</p>}<label>Note (optional)<textarea rows="3" maxLength="1000" value={viewingNote} onChange={(event) => setViewingNote(event.target.value)} placeholder="Share anything the seller should know"/></label>{viewingError && <p className="error-banner" role="alert">{viewingError}</p>}{viewingMessage && <p className="success-banner" role="status">{viewingMessage} <Link to="/viewings">View requests</Link></p>}<button className="button button-quiet" disabled={viewingBusy || !viewingSlotId}>{viewingBusy ? 'Sending…' : 'Request this time'}</button></form>}
      </aside>
    </div>
    <section className="reviews-section" aria-labelledby="reviews-title">
      <div className="reviews-heading"><div><span className="eyebrow">Experiences shared</span><h2 id="reviews-title">Reviews</h2><p className="muted">Only buyers who have messaged about the home or seller can leave a review. Reviews reflect personal experiences and are not property inspections.</p></div><div className="review-tabs" role="tablist" aria-label="Review type"><button type="button" role="tab" aria-selected={reviewTab === 'property'} className={reviewTab === 'property' ? 'selected' : ''} onClick={() => setReviewTab('property')}>This home</button><button type="button" role="tab" aria-selected={reviewTab === 'seller'} className={reviewTab === 'seller' ? 'selected' : ''} onClick={() => setReviewTab('seller')}>Seller</button></div></div>
      <div className="review-rating-line"><strong>{visibleRating ? `★ ${visibleRating}` : 'No ratings yet'}</strong><span>{visibleReviews.length} {visibleReviews.length === 1 ? 'review' : 'reviews'}</span></div>
      {visibleReviews.length ? <div className="review-list">{visibleReviews.map((review) => <article className="review-card" key={review._id}><div className="review-card-heading"><strong>{review.reviewer?.name || 'Tsuki member'}</strong><span aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}<span className="empty-stars">{'★'.repeat(5 - review.rating)}</span></span></div><p>{review.comment}</p><time dateTime={review.createdAt}>{new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(review.createdAt))}</time></article>)}</div> : <p className="empty-reviews">No {reviewTab === 'property' ? 'home' : 'seller'} reviews yet.</p>}
      {auth?.user?.role === 'buyer' && <form className="review-form" onSubmit={submitReview}>
        <h3>{existingReview ? 'Update your review' : 'Share your experience'}</h3>
        <div className="review-form-grid"><label>Review<select value={reviewTarget} onChange={(event) => { const target = event.target.value; const saved = target === 'property' ? reviewEligibility?.propertyReview : reviewEligibility?.sellerReview; setReviewTarget(target); setReviewRating(String(saved?.rating || 5)); setReviewComment(null); setReviewError(''); setReviewMessage(''); }}><option value="property">This home</option><option value="seller">The seller</option></select></label><fieldset className="star-rating-field"><legend>Your rating</legend><div className="star-rating-options">{[1, 2, 3, 4, 5].map((rating) => { const inputId = `review-rating-${property._id}-${rating}`; return <span className="star-rating-choice" key={rating}><input id={inputId} type="radio" name="review-rating" value={rating} checked={Number(reviewRating) === rating} onChange={(event) => setReviewRating(event.target.value)}/><label className={Number(reviewRating) >= rating ? 'is-filled' : ''} htmlFor={inputId} title={`${rating} ${rating === 1 ? 'star' : 'stars'}`}><span className="sr-only">{rating} {rating === 1 ? 'star' : 'stars'}</span><span aria-hidden="true">★</span></label></span>; })}<output aria-live="polite">{reviewRating} of 5</output></div></fieldset></div>
        <label>Your review<textarea required maxLength={1200} rows={4} value={reviewComment ?? existingReview?.comment ?? ''} onChange={(event) => setReviewComment(event.target.value)} placeholder="What would you like others to know?" /></label>
        {reviewEligibility && !canReview && !existingReview && <p className="muted review-hint">Contact the seller about this home before posting a review.</p>}
        {reviewError && <p className="error-banner" role="alert">{reviewError}</p>}{reviewMessage && <p className="success-banner" role="status">{reviewMessage}</p>}
        <button className="button" disabled={reviewBusy || !canReview}>{reviewBusy ? 'Saving…' : existingReview ? 'Update review' : 'Post review'}</button>
      </form>}
      {!auth?.user && <p className="review-sign-in"><Link to="/login">Sign in</Link> as a buyer to leave a review after contacting the seller.</p>}
    </section>
  </section>;
}
export function SellerProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api.get(`/api/property/sellers/${id}`).then(({ data }) => { if (active) setProfile(data); }).catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load this seller profile.'); });
    return () => { active = false; };
  }, [id]);
  if (error) return <section className="page-wrap"><p className="error-banner" role="alert">{error}</p><Link to="/properties">Browse properties</Link></section>;
  if (!profile) return <p className="loading">Loading seller profile…</p>;
  const responseTime = profile.trust.averageResponseMinutes == null ? null : profile.trust.averageResponseMinutes < 60 ? `About ${profile.trust.averageResponseMinutes} min` : `About ${(profile.trust.averageResponseMinutes / 60).toFixed(1)} hr`;
  return <section className="page-wrap seller-profile-page"><Link className="text-link" to="/properties">← Browse homes</Link><header className="seller-profile-header"><div className="seller-profile-avatar">{profile.seller.profilePic ? <img src={profile.seller.profilePic} alt=""/> : profile.seller.name?.charAt(0)?.toUpperCase()}</div><div><span className="eyebrow">Seller profile</span><h1>{profile.seller.name}</h1><p>Member since {new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long' }).format(new Date(profile.seller.memberSince))}</p></div></header><div className="seller-trust-grid"><article><span>Seller rating</span><strong>{profile.rating ? `★ ${profile.rating}` : '—'}</strong><small>{profile.reviewCount} buyer {profile.reviewCount === 1 ? 'review' : 'reviews'}</small></article><article><span>Response rate</span><strong>{profile.trust.responseRate == null ? '—' : `${profile.trust.responseRate}%`}</strong><small>{profile.trust.responseSampleSize ? `Across ${profile.trust.responseSampleSize} conversations` : 'No response history yet'}</small></article><article><span>Average reply</span><strong>{responseTime || '—'}</strong><small>{responseTime ? 'Based on buyer conversations' : 'No response history yet'}</small></article><article><span>Active homes</span><strong>{profile.trust.activeListings}</strong><small>{profile.trust.reviewedListings} Tsuki-reviewed listings</small></article></div>{profile.reviews.length > 0 && <section className="seller-profile-reviews"><div className="section-heading"><div><span className="eyebrow">Buyer experiences</span><h2>Seller reviews</h2></div></div><div className="review-list">{profile.reviews.map((review) => <article className="review-card" key={review._id}><div className="review-card-heading"><strong>{review.reviewer?.name || 'Tsuki member'}</strong><span aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}<span className="empty-stars">{'★'.repeat(5 - review.rating)}</span></span></div><p>{review.comment}</p><time dateTime={review.createdAt}>{new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(review.createdAt))}</time></article>)}</div></section>}<section className="seller-profile-listings"><div className="section-heading"><div><span className="eyebrow">Currently available</span><h2>Listings by {profile.seller.name.split(' ')[0]}</h2></div></div>{profile.properties.length ? <div className="property-grid">{profile.properties.map((property) => <PropertyCard key={property._id} property={property}/>)}</div> : <p className="empty-state">No active listings right now.</p>}</section></section>;
}

