import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../../app/api.js';
import { useAuth } from '../../../app/auth.jsx';
import { money } from '../../../app/formatters.js';
import { PropertyCard } from '../components/PropertyCard.jsx';
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
      api
        .get('/api/property', { params: { ...params, page, pageSize: 12 } })
        .then(({ data }) => {
          setListings(data.properties);
          setPagination(data);
          setError('');
        })
        .catch(() => setError('Could not load properties. Check that the API is running.'))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [filters, page]);

  const update = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const clear = () => {
    setPage(1);
    setFilters({
      city: '',
      propertyType: '',
      purpose: '',
      bhk: '',
      minPrice: '',
      maxPrice: '',
      sort: 'latest',
    });
  };
  const activeFilters = [
    filters.city && { key: 'city', label: filters.city },
    filters.propertyType && { key: 'propertyType', label: filters.propertyType },
    filters.purpose && {
      key: 'purpose',
      label: filters.purpose === 'rent' ? 'For rent' : 'For sale',
    },
    filters.bhk && { key: 'bhk', label: `${filters.bhk} BHK` },
    filters.minPrice && { key: 'minPrice', label: `From ${money(filters.minPrice)}` },
    filters.maxPrice && { key: 'maxPrice', label: `Up to ${money(filters.maxPrice)}` },
  ].filter(Boolean);
  const saveSearch = async () => {
    if (auth?.user?.role !== 'buyer') {
      nav('/login');
      return;
    }
    setAlertMessage('');
    setAlertError(false);
    try {
      const searchFilters = Object.fromEntries(
        Object.entries(filters).filter(([key, value]) => key !== 'sort' && value),
      );
      await api.post('/api/search-alerts', { filters: searchFilters });
      setAlertMessage('Search saved. New matching listings will appear in Search alerts.');
    } catch (requestError) {
      setAlertError(true);
      setAlertMessage(requestError.response?.data?.message || 'Could not save this search.');
    }
  };

  return (
    <section className="page-wrap">
      <div className="page-intro">
        <span className="eyebrow">The Tsuki collection</span>
        <h1>
          Homes with
          <br />
          <em>character.</em>
        </h1>
        <p>Explore places to buy or rent, and narrow the search to what suits you.</p>
      </div>
      <div className="filters">
        <label>
          Buy or rent
          <select value={filters.purpose} onChange={(e) => update('purpose', e.target.value)}>
            <option value="">Buy and rent</option>
            <option value="sale">For sale</option>
            <option value="rent">For rent</option>
          </select>
        </label>
        <label>
          Location
          <input
            aria-label="Filter by city or area"
            value={filters.city}
            onChange={(e) => update('city', e.target.value)}
            placeholder="City or area"
          />
        </label>
        <label>
          Property type
          <select
            value={filters.propertyType}
            onChange={(e) => update('propertyType', e.target.value)}
          >
            <option value="">All types</option>
            <option value="flat">Apartment</option>
            <option value="villa">Villa</option>
            <option value="house">House</option>
            <option value="commercial">Commercial</option>
            <option value="plot">Plot</option>
          </select>
        </label>
        <label>
          Bedrooms
          <select value={filters.bhk} onChange={(e) => update('bhk', e.target.value)}>
            <option value="">Any</option>
            {['1', '2', '3', '4', '5+'].map((n) => (
              <option key={n} value={n}>
                {n} BHK
              </option>
            ))}
          </select>
        </label>
        <label>
          Minimum price
          <input
            type="number"
            min="0"
            step="100000"
            value={filters.minPrice}
            onChange={(e) => update('minPrice', e.target.value)}
            placeholder="No minimum"
          />
        </label>
        <label className="max-price-filter">
          Maximum price <span>{filters.maxPrice ? money(filters.maxPrice) : 'Any price'}</span>
          <input
            aria-label="Maximum price"
            type="range"
            min="100000"
            max="100000000"
            step="500000"
            value={filters.maxPrice || 100000000}
            onChange={(e) => update('maxPrice', e.target.value)}
          />
        </label>
        <label>
          Sort by
          <select value={filters.sort} onChange={(e) => update('sort', e.target.value)}>
            <option value="latest">Recently added</option>
            <option value="priceLow">Price: low to high</option>
            <option value="priceHigh">Price: high to low</option>
          </select>
        </label>
        <button className="button button-quiet" type="button" onClick={clear}>
          Reset filters
        </button>
      </div>
      <div className="active-filters" aria-label="Active search filters">
        {activeFilters.map((filter) => (
          <span className="filter-chip" key={filter.key}>
            {filter.label}
            <button
              type="button"
              aria-label={`Remove ${filter.label} filter`}
              onClick={() => update(filter.key, '')}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="results-heading">
        <span aria-live="polite">
          {loading
            ? 'Searching…'
            : `${pagination.total} ${pagination.total === 1 ? 'property' : 'properties'}`}
        </span>
        <div className="results-actions">
          <span>
            {filters.purpose === 'rent'
              ? 'For rent'
              : filters.purpose === 'sale'
                ? 'For sale'
                : 'For sale or rent'}
          </span>
          <div className="view-toggle" role="group" aria-label="Search result view">
            <button
              type="button"
              className={viewMode === 'list' ? 'selected' : ''}
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
            <button
              type="button"
              className={viewMode === 'map' ? 'selected' : ''}
              aria-pressed={viewMode === 'map'}
              onClick={() => setViewMode('map')}
            >
              Map
            </button>
          </div>
          {auth?.user?.role === 'buyer' && (
            <button type="button" className="text-link save-search-button" onClick={saveSearch}>
              Save search ♧
            </button>
          )}
        </div>
      </div>
      {alertMessage && (
        <p
          className={alertError ? 'error-banner' : 'success-banner'}
          role={alertError ? 'alert' : 'status'}
        >
          {alertMessage}
        </p>
      )}
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="loading" role="status">
          Finding available homes…
        </p>
      ) : listings.length ? (
        viewMode === 'map' ? (
          <PropertyMap properties={listings} />
        ) : (
          <div className="property-grid">
            {listings.map((property) => (
              <PropertyCard key={property._id} property={property} />
            ))}
          </div>
        )
      ) : (
        <div className="empty-state">
          No homes match these filters. Adjust your search or reset the filters.
        </div>
      )}
      {!loading && pagination.totalPages > 1 && (
        <nav className="pagination" aria-label="Property pages">
          <button
            className="button button-quiet"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {pagination.totalPages}
          </span>
          <button
            className="button button-quiet"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
function PropertyMap({ properties }) {
  const [geocoded, setGeocoded] = useState({});
  const [locating, setLocating] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const propertyKey = properties.map((property) => property._id).join(',');
  useEffect(() => {
    let active = true;
    const locate = async () => {
      const missing = properties.filter(
        (property) => property.latitude == null || property.longitude == null,
      );
      if (!missing.length) return;
      setLocating(true);
      let lastLookup = 0;
      for (const property of missing) {
        if (!active) break;
        const place = [property.area, property.city, property.pincode, 'India']
          .filter(Boolean)
          .join(', ');
        const cacheKey = `tsuki-map:${place.toLowerCase()}`;
        try {
          const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
          if (Array.isArray(cached)) {
            if (cached.length === 2)
              setGeocoded((current) => ({ ...current, [property._id]: cached }));
            continue;
          }
          const wait = Math.max(0, 1100 - (Date.now() - lastLookup));
          if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
          lastLookup = Date.now();
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(place)}`,
            { headers: { Accept: 'application/json' } },
          );
          if (!response.ok) continue;
          const results = await response.json();
          const coords = results[0] ? [Number(results[0].lat), Number(results[0].lon)] : [];
          try {
            localStorage.setItem(cacheKey, JSON.stringify(coords));
          } catch {
            /* The map can still use this result for this visit. */
          }
          if (coords.length === 2 && coords.every(Number.isFinite))
            setGeocoded((current) => ({ ...current, [property._id]: coords }));
        } catch {
          /* Map still lists homes without a resolvable address. */
        }
      }
      if (active) setLocating(false);
    };
    locate();
    return () => {
      active = false;
    };
  }, [properties, propertyKey]);
  const mapped = properties.flatMap((property) => {
    const coords =
      property.latitude != null && property.longitude != null
        ? [Number(property.latitude), Number(property.longitude)]
        : geocoded[property._id];
    return coords?.length === 2 && coords.every(Number.isFinite)
      ? [{ ...property, latitude: coords[0], longitude: coords[1] }]
      : [];
  });
  useEffect(() => {
    if (
      selectedPropertyId &&
      !mapped.some((property) => String(property._id) === selectedPropertyId)
    )
      setSelectedPropertyId('');
  }, [mapped, propertyKey, selectedPropertyId, geocoded]);
  if (!mapped.length)
    return (
      <div className="empty-state map-empty">
        <h2>{locating ? 'Locating these homes…' : 'No map pins for these homes'}</h2>
        <p>
          {locating
            ? 'Looking up the listing areas on OpenStreetMap.'
            : 'Try the map again later or refine the search location.'}
        </p>
      </div>
    );
  const latitudes = mapped.map((property) => Number(property.latitude));
  const longitudes = mapped.map((property) => Number(property.longitude));
  const latSpan = Math.max(Math.max(...latitudes) - Math.min(...latitudes), 0.012);
  const lonSpan = Math.max(Math.max(...longitudes) - Math.min(...longitudes), 0.012);
  const south = Math.max(-85, Math.min(...latitudes) - latSpan * 0.25);
  const north = Math.min(85, Math.max(...latitudes) + latSpan * 0.25);
  const west = Math.max(-180, Math.min(...longitudes) - lonSpan * 0.25);
  const east = Math.min(180, Math.max(...longitudes) + lonSpan * 0.25);
  const bbox = `${west},${south},${east},${north}`;
  const selectedProperty = mapped.find((property) => String(property._id) === selectedPropertyId);
  return (
    <div className="property-map-layout">
      <div className="property-map">
        <iframe
          title="Map of matching property locations"
          loading="lazy"
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`}
        />
        <div className="map-pins">
          {mapped.map((property, index) => (
            <button
              key={property._id}
              type="button"
              className={`map-pin${String(property._id) === selectedPropertyId ? ' is-selected' : ''}`}
              style={{
                left: `${((Number(property.longitude) - west) / (east - west)) * 100}%`,
                top: `${(1 - (Number(property.latitude) - south) / (north - south)) * 100}%`,
              }}
              title={`Select ${property.title}`}
              aria-label={`Select ${property.title} on map`}
              aria-pressed={String(property._id) === selectedPropertyId}
              onMouseEnter={() => setSelectedPropertyId(String(property._id))}
              onFocus={() => setSelectedPropertyId(String(property._id))}
              onClick={() => setSelectedPropertyId(String(property._id))}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
      <div className="map-result-list">
        {mapped.map((property, index) => (
          <article
            className={`map-result${String(property._id) === selectedPropertyId ? ' is-selected' : ''}`}
            key={property._id}
          >
            <button
              type="button"
              aria-label={`Highlight ${property.title} on map`}
              aria-pressed={String(property._id) === selectedPropertyId}
              onMouseEnter={() => setSelectedPropertyId(String(property._id))}
              onFocus={() => setSelectedPropertyId(String(property._id))}
              onClick={() => setSelectedPropertyId(String(property._id))}
            >
              {index + 1}
            </button>
            <Link
              to={`/properties/${property._id}`}
              onMouseEnter={() => setSelectedPropertyId(String(property._id))}
              onFocus={() => setSelectedPropertyId(String(property._id))}
            >
              <strong>{property.title}</strong>
              <small>
                {property.area}, {property.city} · {money(property.price)}
                {property.purpose === 'rent' ? ' / month' : ''}
              </small>
            </Link>
          </article>
        ))}
        {mapped.length < properties.length && (
          <p className="muted">
            {properties.length - mapped.length}{' '}
            {properties.length - mapped.length === 1 ? 'listing has' : 'listings have'} no map pin
            yet.
          </p>
        )}
        <small className="map-attribution">Map data © OpenStreetMap contributors</small>
      </div>
      <p className="sr-only" aria-live="polite">
        {selectedProperty ? `Selected ${selectedProperty.title} on the map.` : ''}
      </p>
    </div>
  );
}
