import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import heroImage from '../../../assets/images/hero-apartment.jpg';
import { api } from '../../../app/api.js';
import { useAuth } from '../../../app/auth.jsx';
import { PROPERTY_COLLECTIONS } from '../property-info.js';
import { PropertyCard } from '../components/PropertyCard.jsx';
import { PropertyCollectionCard } from '../components/PropertyCollectionCard.jsx';
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
  useEffect(() => {
    api
      .get('/api/property', { params: { pageSize: 6 } })
      .then((response) => setProperties(response.data.properties))
      .catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    Promise.allSettled(
      PROPERTY_COLLECTIONS.map((item) =>
        api.get('/api/property', { params: { propertyType: item.type, pageSize: 24 } }),
      ),
    ).then((results) => {
      if (!active) return;
      setCollectionProperties(
        Object.fromEntries(
          results.flatMap((result, index) =>
            result.status === 'fulfilled'
              ? [[PROPERTY_COLLECTIONS[index].type, result.value.data.properties]]
              : [],
          ),
        ),
      );
    });
    return () => {
      active = false;
    };
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
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-image">
          <img
            src={heroImage}
            alt="Apartment living room with warm timber details and a balcony view"
            fetchPriority="high"
          />
        </div>
        <div className="home-hero-shade" />
        <div className="home-hero-copy">
          <span className="eyebrow">Search homes to buy or rent</span>
          <h1>
            Find a place
            <br />
            that feels like <em>yours.</em>
          </h1>
          <p>
            Search by location, budget and property type. Save favorites, compare homes and speak
            directly with sellers.
          </p>
          <Link className="hero-cta" to="/properties">
            Explore properties <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <form className="home-search" onSubmit={search} aria-label="Search properties">
          <div className="purpose-switch" role="group" aria-label="Buy or rent">
            <button
              type="button"
              className={purpose === 'sale' ? 'selected' : ''}
              aria-pressed={purpose === 'sale'}
              onClick={() => {
                setPurpose('sale');
                setBudget('');
              }}
            >
              Buy
            </button>
            <button
              type="button"
              className={purpose === 'rent' ? 'selected' : ''}
              aria-pressed={purpose === 'rent'}
              onClick={() => {
                setPurpose('rent');
                setBudget('');
              }}
            >
              Rent
            </button>
          </div>
          <label className="home-search-field">
            <span>Location</span>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City or neighbourhood"
            />
          </label>
          <label className="home-search-field">
            <span>Property type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">Any type</option>
              <option value="apartment">Apartment</option>
              <option value="villa">Villa</option>
              <option value="house">House</option>
              <option value="commercial">Commercial</option>
              <option value="plot">Plot</option>
            </select>
          </label>
          <label className="home-search-field">
            <span>Price range</span>
            <select value={budget} onChange={(event) => setBudget(event.target.value)}>
              <option value="">Any budget</option>
              {purpose === 'sale' ? (
                <>
                  <option value="0-5000000">Under ₹50 lakh</option>
                  <option value="5000000-10000000">₹50 lakh – ₹1 crore</option>
                  <option value="10000000-50000000">₹1 – ₹5 crore</option>
                  <option value="50000000-0">Above ₹5 crore</option>
                </>
              ) : (
                <>
                  <option value="0-25000">Under ₹25,000 / month</option>
                  <option value="25000-50000">₹25,000 – ₹50,000 / month</option>
                  <option value="50000-100000">₹50,000 – ₹1 lakh / month</option>
                  <option value="100000-0">Above ₹1 lakh / month</option>
                </>
              )}
            </select>
          </label>
          <button className="search-submit" type="submit" aria-label="Search homes">
            <span>Search homes</span>
            <b aria-hidden="true">↗</b>
          </button>
        </form>
      </section>

      <section className="home-section home-collections">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Browse current listings</span>
            <h2>Find homes by type.</h2>
          </div>
          <p>Explore available apartments, houses, villas and commercial spaces.</p>
        </div>
        <div className="collection-grid">
          {PROPERTY_COLLECTIONS.map((item) => (
            <PropertyCollectionCard
              key={item.type}
              item={item}
              properties={collectionProperties[item.type] || []}
            />
          ))}
        </div>
      </section>

      <section className="home-section home-featured" aria-label="Latest listings">
        <div className="section-heading">
          <div>
            <h2>Latest listings</h2>
          </div>
          <div className="featured-actions">
            <Link className="section-link" to="/properties">
              View all properties <span aria-hidden="true">↗</span>
            </Link>
            {featuredPages > 1 && (
              <div className="featured-controls" aria-label="Featured listing pages">
                <button
                  type="button"
                  className="featured-arrow"
                  aria-label="Show previous homes"
                  onClick={() =>
                    setFeaturedPage((page) => (page - 1 + featuredPages) % featuredPages)
                  }
                >
                  ←
                </button>
                <span aria-live="polite">
                  {String(featuredPage + 1).padStart(2, '0')} /{' '}
                  {String(featuredPages).padStart(2, '0')}
                </span>
                <button
                  type="button"
                  className="featured-arrow"
                  aria-label="Show more homes"
                  onClick={() => setFeaturedPage((page) => (page + 1) % featuredPages)}
                >
                  →
                </button>
              </div>
            )}
          </div>
        </div>
        {properties.length ? (
          <div className="property-grid" key={featuredPage}>
            {featuredListings.map((property, index) => (
              <PropertyCard
                key={property._id}
                property={property}
                autoRotate
                rotationDelay={index * 1700}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">No published listings yet.</div>
        )}
      </section>

      <section className="home-values">
        <div className="values-heading">
          <span className="eyebrow">A practical path to a home</span>
          <h2>
            Search.
            <br />
            Compare.
            <br />
            Connect.
          </h2>
        </div>
        <div className="values-list">
          <article>
            <div>
              <h3>Search your way</h3>
              <p>
                Filter by location, budget, property type and buy or rent. Switch between list and
                map views to explore matching listings.
              </p>
            </div>
          </article>
          <article>
            <div>
              <h3>Build a shortlist</h3>
              <p>
                Save favorite homes, compare up to four listings side by side, and save searches to
                revisit matching properties.
              </p>
            </div>
          </article>
          <article>
            <div>
              <h3>Talk with context</h3>
              <p>
                Message sellers, request a viewing, and read reviews from buyers who have contacted
                the seller. Flag a listing if something seems wrong.
              </p>
            </div>
          </article>
        </div>
      </section>

      {(!auth?.user || auth.user.role === 'seller') && (
        <section className="home-owner-cta">
          <div>
            <span className="eyebrow">For property owners</span>
            <h2>Have a property to list?</h2>
            <p>
              Add photos, pricing, location and property details. Manage conversations and viewing
              requests from your seller studio.
            </p>
            <Link
              className="hero-cta"
              to={auth?.user?.role === 'seller' ? '/new-listing' : '/register'}
            >
              List your property <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <span className="owner-mark" aria-hidden="true">
            T.
          </span>
        </section>
      )}
    </div>
  );
}
