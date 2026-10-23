import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './index.css';
import heroImage from './assets/hero-apartment.jpg';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PROPERTY_COLLECTIONS = [
  { type: 'apartment,flat,studio,penthouse', title: 'Apartments', subtitle: 'Apartments, flats, studios and penthouses', matches: ['apartment', 'flat', 'studio', 'penthouse'] },
  { type: 'villa,house,townhouse', title: 'Villas & houses', subtitle: 'Villas, houses and townhouses', matches: ['villa', 'house', 'townhouse'] },
  { type: 'commercial,office', title: 'Commercial spaces', subtitle: 'Offices and commercial listings', matches: ['commercial', 'office'] },
];
const AuthContext = createContext(null);
const PropertyToolsContext = createContext(null);
const NotificationContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const usePropertyTools = () => useContext(PropertyToolsContext);
const useNotifications = () => useContext(NotificationContext);
function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reducedMotion;
}
const api = axios.create({ baseURL: API });
api.interceptors.request.use((config) => {
  try {
    const token = JSON.parse(localStorage.getItem('realstate-session'))?.token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    else delete config.headers.Authorization;
  } catch {
    delete config.headers.Authorization;
  }
  return config;
});
function AuthProvider({ children }) {
  const [session, setSession] = useState(() => { try { return JSON.parse(localStorage.getItem('realstate-session')) || null; } catch { return null; } });
  const setAuth = (data) => { localStorage.setItem('realstate-session', JSON.stringify(data)); setSession(data); };
  const logout = () => { localStorage.removeItem('realstate-session'); setSession(null); };
  return <AuthContext.Provider value={{ ...session, setAuth, logout }}>{children}</AuthContext.Provider>;
}
function NotificationProvider({ children }) {
  const auth = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!['buyer', 'seller'].includes(auth?.user?.role)) { setUnreadCount(0); return undefined; }
    let active = true;
    const controller = new AbortController();
    const refresh = () => api.get('/api/notifications').then(({ data }) => { if (active) setUnreadCount(data.unreadCount || 0); }).catch(() => {});
    refresh();
    watchChatUpdates(refresh, controller.signal);
    const interval = window.setInterval(refresh, 45_000);
    return () => { active = false; controller.abort(); window.clearInterval(interval); };
  }, [auth?.user?._id, auth?.user?.role]);
  const refreshNotifications = () => api.get('/api/notifications').then(({ data }) => {
    setUnreadCount(data.unreadCount || 0);
    return data;
  });
  return <NotificationContext.Provider value={{ unreadCount, refreshNotifications }}>{children}</NotificationContext.Provider>;
}
function PropertyToolsProvider({ children }) {
  const auth = useAuth();
  const [savedIds, setSavedIds] = useState([]);
  const [comparisonIds, setComparisonIds] = useState(() => {
    try { const stored = JSON.parse(localStorage.getItem('tsuki-comparison') || '[]'); return Array.isArray(stored) ? stored.slice(0, 4) : []; } catch { return []; }
  });
  useEffect(() => {
    if (auth?.user?.role !== 'buyer') { setSavedIds([]); return undefined; }
    let active = true;
    api.get('/api/favorites').then(({ data }) => {
      if (active) setSavedIds(data.properties.map((property) => String(property._id)));
    }).catch(() => { if (active) setSavedIds([]); });
    return () => { active = false; };
  }, [auth?.user?._id, auth?.user?.role]);
  useEffect(() => { localStorage.setItem('tsuki-comparison', JSON.stringify(comparisonIds)); }, [comparisonIds]);
  const toggleSaved = async (propertyId) => {
    if (auth?.user?.role !== 'buyer') return { success: false, loginRequired: true };
    const id = String(propertyId);
    const wasSaved = savedIds.includes(id);
    try {
      if (wasSaved) await api.delete(`/api/favorites/${id}`);
      else await api.put(`/api/favorites/${id}`);
      setSavedIds((current) => wasSaved ? current.filter((savedId) => savedId !== id) : [...new Set([...current, id])]);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Could not update saved homes.' };
    }
  };
  const toggleComparison = (propertyId) => {
    const id = String(propertyId);
    if (comparisonIds.includes(id)) {
      setComparisonIds((current) => current.filter((item) => item !== id));
      return { success: true, added: false };
    }
    if (comparisonIds.length >= 4) return { success: false, message: 'Compare up to four homes at a time.' };
    setComparisonIds((current) => [...current, id]);
    return { success: true, added: true };
  };
  return <PropertyToolsContext.Provider value={{ savedIds, comparisonIds, toggleSaved, toggleComparison, setComparisonIds }}>{children}</PropertyToolsContext.Provider>;
}
const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const localDateKey = (value) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const availabilityInfo = (property) => {
  if (property.status && property.status !== 'sale') return { stale: false, label: '' };
  const confirmedAt = property.availabilityConfirmedAt || property.updatedAt || property.createdAt;
  if (!confirmedAt) return { stale: true, label: 'Availability unconfirmed' };
  const days = Math.max(0, Math.floor((Date.now() - new Date(confirmedAt).getTime()) / 86_400_000));
  const stale = property.availabilityNeedsConfirmation ?? days > 30;
  return { stale, label: stale ? 'Availability unconfirmed' : days === 0 ? 'Confirmed today' : days === 1 ? 'Confirmed yesterday' : `Confirmed ${days} days ago` };
};
async function watchChatUpdates(onUpdate, signal) {
  let token;
  try { token = JSON.parse(localStorage.getItem('realstate-session'))?.token; } catch { return; }
  if (!token) return;

  while (!signal.aborted) {
    try {
      const response = await fetch(`${API}/api/chats/events`, { headers: { Authorization: `Bearer ${token}` }, signal });
      if (!response.ok || !response.body) throw new Error('Chat updates are temporarily unavailable.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';
        for (const event of events) {
          const dataLine = event.split(/\r?\n/).find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          try { onUpdate(JSON.parse(dataLine.slice(5).trim())); } catch { /* Ignore malformed event data. */ }
        }
      }
      await reader.cancel().catch(() => {});
    } catch {
      if (signal.aborted) return;
    }
    if (!signal.aborted) await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}
function Brand() { return <Link className="brand" to="/" aria-label="Tsuki home"><svg className="brand-symbol" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.463.402.807a6.5 6.5 0 0 0 8.268 8.268c.344-.215.829-.003.803.397z"/></svg><span>TSUKI</span></Link>; }
const availabilityLabel = (property) => property.status === 'unavailable' ? 'Unavailable' : property.status === 'sold' ? 'Sold' : property.status === 'rented' ? 'Rented' : property.purpose === 'rent' ? 'For rent' : 'For sale';
function Header() {
  const auth = useAuth();
  const { savedIds, comparisonIds } = usePropertyTools();
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const sellPath = auth?.user?.role === 'seller' ? '/new-listing' : '/register';
  const closeMenu = () => setOpen(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') closeMenu(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);
  return <header className="topbar">
    <Brand />
    <button className="menu-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-controls="main-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '✕' : '☰'}</button>
    <nav id="main-navigation" className={open ? 'nav-open' : ''} aria-label="Main navigation">
      <NavLink onClick={closeMenu} to="/properties" className={({ isActive }) => isActive ? 'nav-active' : ''}>Explore</NavLink>
      {auth?.user?.role === 'buyer' && <NavLink onClick={closeMenu} to="/saved" className={({ isActive }) => isActive ? 'nav-active' : ''}>Saved homes{savedIds.length > 0 && <span className="nav-count">{savedIds.length}</span>}</NavLink>}
      {auth?.user?.role === 'buyer' && <NavLink onClick={closeMenu} to="/alerts" className={({ isActive }) => isActive ? 'nav-active' : ''}>Search alerts</NavLink>}
      {auth?.user && auth.user.role !== 'admin' && <NavLink onClick={closeMenu} to="/viewings" className={({ isActive }) => isActive ? 'nav-active' : ''}>Viewings</NavLink>}
      {comparisonIds.length > 0 && <NavLink onClick={closeMenu} to="/compare" className={({ isActive }) => isActive ? 'nav-active' : ''}>Compare<span className="nav-count">{comparisonIds.length}</span></NavLink>}
      {['buyer', 'seller'].includes(auth?.user?.role) && <NavLink onClick={closeMenu} to="/notifications" className={({ isActive }) => isActive ? 'nav-active' : ''}>Notifications{unreadCount > 0 && <span className="nav-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}</NavLink>}
      {auth?.user?.role === 'seller' && <NavLink onClick={closeMenu} to="/dashboard" className={({ isActive }) => isActive ? 'nav-active' : ''}>Seller studio</NavLink>}
      {auth?.user?.role === 'seller' && <NavLink onClick={closeMenu} to="/leads" className={({ isActive }) => isActive ? 'nav-active' : ''}>Leads</NavLink>}
      {auth?.user?.role === 'admin' && <NavLink onClick={closeMenu} to="/admin" className={({ isActive }) => isActive ? 'nav-active' : ''}>Admin</NavLink>}
      {auth?.user && <NavLink onClick={closeMenu} to="/messages" className={({ isActive }) => isActive ? 'nav-active' : ''}>Messages</NavLink>}
      {auth?.user?.role !== 'admin' && <NavLink onClick={closeMenu} to="/contact" className={({ isActive }) => isActive ? 'nav-active' : ''}>Contact</NavLink>}
      {(!auth?.user || auth.user.role === 'seller') && <NavLink onClick={closeMenu} to={sellPath} className="nav-sell">List a property <span aria-hidden="true">↗</span></NavLink>}
    </nav>
    <div className="nav-actions">{auth?.user ? <><Link className="welcome profile-link" to="/profile">{auth.user.name.split(' ')[0]}</Link><button className="button button-quiet" onClick={auth.logout}>Sign out</button></> : <><Link to="/login" className="login-link">Sign in</Link><Link to="/register" className="button button-small">Create account</Link></>}</div>
  </header>;
}
function Layout({ children }) {
  const auth = useAuth();
  const sellPath = auth?.user?.role === 'seller' ? '/new-listing' : '/register';
  return <><a className="skip-link" href="#main-content">Skip to main content</a><Header /><main id="main-content" tabIndex="-1">{children}</main><footer className="site-footer"><div className="footer-main"><div className="footer-brand"><Brand /><p>A considered way to discover<br />the place you’ll call home.</p></div><div className="footer-column"><span>Discover</span><Link to="/properties">All properties</Link><Link to="/properties?purpose=sale">Homes to buy</Link><Link to="/properties?purpose=rent">Homes to rent</Link></div><div className="footer-column"><span>Tsuki</span>{auth?.user?.role !== 'admin' && <Link to="/contact">Contact</Link>}{auth?.user ? <Link to="/profile">Your profile</Link> : <Link to="/login">Sign in</Link>}{(!auth?.user || auth.user.role === 'seller') && <Link to={sellPath}>List a property</Link>}</div><div className="footer-note"><span className="eyebrow">A quieter way to find home</span><p>Thoughtful spaces.<br />Clear details. Direct conversations.</p></div></div><div className="footer-bottom"><span className="footer-copyright">© {new Date().getFullYear()} Tsuki <MoonEgg/></span><span>Made for finding what feels right.</span><span className="photo-attribution">Hero photo: <a href="https://commons.wikimedia.org/wiki/File:Modern_living_room_with_stylish_furniture_and_a_view_of_the_outdoors_in_a_cozy_apartment_setting.jpg" target="_blank" rel="noreferrer">Shixart1985</a> · <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noreferrer">CC BY 2.0</a> · cropped and toned</span>{auth?.user?.role !== 'admin' && <Link to="/contact">Get in touch ↗</Link>}</div></footer><Moonlight/></>;
}
function Moonlight() {
  const stageRef = useRef(null);
  const glowRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  useEffect(() => {
    const stage = stageRef.current;
    const glow = glowRef.current;
    if (!stage || !glow || reducedMotion) return undefined;
    let frame = 0;
    let x = 0;
    let y = 0;
    let lastSparkleAt = 0;
    let lastSparkleX = 0;
    let lastSparkleY = 0;
    const move = (event) => {
      if (event.pointerType === 'touch') return;
      x = event.clientX;
      y = event.clientY;
      const now = performance.now();
      const distance = Math.hypot(x - lastSparkleX, y - lastSparkleY);
      if (now - lastSparkleAt > 115 && distance > 38) {
        const sparkle = document.createElement('span');
        sparkle.className = 'moonlight-sparkle';
        sparkle.textContent = '✦';
        sparkle.style.left = `${x + (Math.random() * 24 - 12)}px`;
        sparkle.style.top = `${y + (Math.random() * 24 - 12)}px`;
        sparkle.addEventListener('animationend', () => sparkle.remove(), { once: true });
        stage.appendChild(sparkle);
        lastSparkleAt = now;
        lastSparkleX = x;
        lastSparkleY = y;
      }
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        glow.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        glow.classList.add('is-visible');
        frame = 0;
      });
    };
    const leave = () => glow.classList.remove('is-visible');
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', leave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reducedMotion]);
  return <div className="moonlight-stage" ref={stageRef} aria-hidden="true"><div className="moonlight-glow" ref={glowRef} /></div>;
}
function MoonEgg() {
  const [open, setOpen] = useState(false);
  return <span className="moon-egg">
    <button type="button" className="moon-egg-trigger" aria-label="Reveal the moon phases" aria-expanded={open} title="A small lunar secret" onClick={() => setOpen((value) => !value)}>☾</button>
    {open && <span className="moon-egg-note" role="status"><span className="moon-egg-phases" aria-hidden="true"><i className="phase-new"/><i className="phase-crescent"/><i className="phase-half"/><i className="phase-full"/></span><span>Every phase belongs.</span></span>}
  </span>;
}
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
function Home() {
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
function Properties() {
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

function PropertyDetail() {
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
function SellerProfile() {
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

function Account({ register = false }) {
  const auth = useAuth(); const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'buyer' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  if (auth?.user) return <Navigate to={auth.user.role === 'admin' ? '/admin' : register && auth.user.role === 'seller' ? '/new-listing' : auth.user.role === 'seller' ? '/dashboard' : '/properties'}/>;
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      let data;
      if (register) {
        ({ data } = await api.post('/api/auth/register', form));
      } else {
        ({ data } = await api.post('/api/auth/login', form));
      }
      auth.setAuth(data);
      nav(data.user.role === 'admin' ? '/admin' : data.user.role === 'seller' ? '/dashboard' : '/properties');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not connect to the server');
    } finally { setBusy(false); }
  };
  return <section className="account-page"><div className="account-orbit" aria-hidden="true"><span className="account-orbit-moon"><svg viewBox="0 0 24 24"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.463.402.807a6.5 6.5 0 0 0 8.268 8.268c.344-.215.829-.003.803.397z"/></svg></span></div><form className="account-card" onSubmit={submit}><span className="eyebrow">Welcome to Tsuki</span><h1>{register ? 'Find your place.' : 'Good to see you.'}</h1><p className="muted">{register ? 'Create an account to get started. You can sign in as soon as it’s created.' : 'Sign in to continue your search.'}</p>{register && <label>Your name<input required maxLength="120" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label>}<label>Email address<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></label><label>Password<input required minLength="8" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}/></label>{register && <label>I am here as<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="buyer">Looking for a home</option><option value="seller">Listing a home</option></select></label>}{error && <p className="error-banner" role="alert">{error}</p>}{!register && <p className="account-switch"><Link to="/forgot-password">Forgot your password?</Link></p>}<button className="button full-button" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button><p className="muted account-switch">{register ? 'Already have an account?' : 'New to Tsuki?'} <Link to={register ? '/login' : '/register'}>{register ? 'Log in' : 'Create an account'}</Link></p></form></section>;
}

function ForgotPassword() {
  return <section className="account-page"><div className="account-card"><span className="eyebrow">Account recovery</span><h1>Forgot your password?</h1><p className="muted">Email recovery is not enabled. If you’re signed in, change your password from your profile. Otherwise, contact the administrator. After verifying account ownership, an administrator can set a temporary password and send it to you privately.</p><Link className="button full-button" to="/contact">Contact the team</Link><p className="account-switch"><Link to="/login">Back to sign in</Link></p></div></section>;
}

function Profile() {
  const auth = useAuth(); const [form, setForm] = useState({ name: auth.user.name || '', phone: auth.user.phone || '', address: auth.user.address || '', profilePic: auth.user.profilePic || '' }); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' }); const [passwordMessage, setPasswordMessage] = useState(''); const [passwordError, setPasswordError] = useState(''); const [passwordBusy, setPasswordBusy] = useState(false);
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { const { data } = await api.patch('/api/auth/me', form); auth.setAuth({ ...auth, user: data.user }); setMessage('Your profile has been updated.'); } catch (e) { setError(e.response?.data?.message || 'Could not update profile.'); } finally { setBusy(false); } };
  const changePassword = async (event) => { event.preventDefault(); setPasswordBusy(true); setPasswordError(''); setPasswordMessage(''); try { const { data } = await api.patch('/api/auth/password', passwordForm); auth.setAuth({ token: data.token, user: data.user }); setPasswordMessage(data.message); setPasswordForm({ currentPassword: '', newPassword: '' }); } catch (e) { setPasswordError(e.response?.data?.message || 'Could not update password.'); } finally { setPasswordBusy(false); } };
  return <section className="page-wrap form-wrap"><span className="eyebrow">Your account</span><h1>Profile</h1><p className="muted">{auth.user.mustChangePassword ? 'Set your new password before updating your profile or using account features.' : 'Update the contact details shown on your account.'}</p>{auth.user.mustChangePassword && <p className="error-banner" role="alert">An administrator reset your password. Set a new password below before using your account.</p>}<form className="listing-form" onSubmit={auth.user.mustChangePassword ? undefined : submit}><label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={auth.user.mustChangePassword}/></label><label>Email<input value={auth.user.email} disabled/></label><label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={auth.user.mustChangePassword}/></label><label>Address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={auth.user.mustChangePassword}/></label><label>Profile image URL<input type="url" value={form.profilePic} onChange={(e) => setForm({ ...form, profilePic: e.target.value })} disabled={auth.user.mustChangePassword}/></label>{message && <p className="success-banner" role="status">{message}</p>}{error && <p className="error-banner" role="alert">{error}</p>}<button className="button" disabled={busy || auth.user.mustChangePassword}>{busy ? 'Saving…' : 'Save profile'}</button></form><h2>Change password</h2><p className="muted">Use your current password to choose a new one.</p><form className="listing-form" onSubmit={changePassword}><label>Current password<input required type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}/></label><label>New password<input required minLength="8" type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}/></label>{passwordMessage && <p className="success-banner" role="status">{passwordMessage}</p>}{passwordError && <p className="error-banner" role="alert">{passwordError}</p>}<button className="button" disabled={passwordBusy}>{passwordBusy ? 'Updating…' : 'Change password'}</button></form></section>;
}

function Contact() {
  const auth = useAuth(); const [form, setForm] = useState({ name: auth?.user?.name || '', email: auth?.user?.email || '', subject: '', message: '' }); const [sent, setSent] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { await api.post('/api/contact', form); setSent(true); } catch (e) { setError(e.response?.data?.message || 'Could not send your message.'); } finally { setBusy(false); } };
  if (auth?.user?.role === 'admin') return <Navigate to="/admin/contacts" replace/>;
  return <section className="page-wrap form-wrap"><span className="eyebrow">We’re here to help</span><h1>Contact Tsuki</h1><p className="muted">Messages are saved to the team’s contact inbox. An administrator will review and reply manually.</p>{sent ? <div className="success-banner" role="status">Thanks for reaching out. Your message is in the team’s contact inbox.</div> : <form className="listing-form" onSubmit={submit}><label>Name<input required maxLength="120" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label><label>Email<input required type="email" maxLength="254" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></label><label>Subject<input required maxLength="160" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}/></label><label>Message<textarea required maxLength="5000" rows="6" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}/></label>{error && <p className="error-banner" role="alert">{error}</p>}<button className="button" disabled={busy}>{busy ? 'Saving…' : 'Send message'}</button></form>}</section>;
}

function Sparkline({ values, label, tone }) {
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${values.length > 1 ? index * (100 / (values.length - 1)) : 50},${30 - (value / max) * 25}`).join(' ');
  return <svg className={`analytics-sparkline ${tone}`} viewBox="0 0 100 34" preserveAspectRatio="none" role="img" aria-label={`${label}, daily values ${values.join(', ')}`}><polyline points={points} vectorEffect="non-scaling-stroke"/></svg>;
}

function Dashboard() {
  const auth = useAuth();
  const [items, setItems] = useState([]);
  const [analytics, setAnalytics] = useState({ summary: { views: 0, saves: 0, conversations: 0, viewings: 0, pendingViewings: 0 }, listings: [], trend: [] });
  const [period, setPeriod] = useState(7);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const refresh = () => Promise.all([api.get('/api/property/mine'), api.get(`/api/property/mine/analytics?days=${period}`)]).then(([propertiesResponse, analyticsResponse]) => {
    setItems(propertiesResponse.data.properties);
    setAnalytics(analyticsResponse.data);
  }).catch((requestError) => setError(requestError.response?.data?.message || 'Could not load your listings'));
  useEffect(() => { refresh(); }, [period]);
  const remove = async (property) => {
    if (!confirm('Delete this listing?')) return;
    try { await api.delete(`/api/property/${property._id}`); refresh(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not delete listing'); }
  };
  const updateStatus = async (property, status) => {
    setBusyId(property._id); setError('');
    try { const { data } = await api.patch(`/api/property/${property._id}`, { status }); setItems((current) => current.map((item) => item._id === property._id ? data.property : item)); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not update availability'); }
    finally { setBusyId(''); }
  };
  const confirmAvailability = async (property) => {
    setBusyId(property._id); setError('');
    try { const { data } = await api.patch(`/api/property/${property._id}/availability`); setItems((current) => current.map((item) => item._id === property._id ? data.property : item)); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not confirm this listing.'); }
    finally { setBusyId(''); }
  };
  const listingAnalytics = new Map(analytics.listings.map((listing) => [listing.propertyId, listing]));
  const trendValues = (metric) => analytics.trend.map((day) => day[metric] || 0);
  return <section className="page-wrap"><div className="dashboard-heading"><div><span className="eyebrow">Your space</span><h1>Seller dashboard</h1><p className="muted">Welcome, {auth.user.name}. Keep your listings up to date.</p></div><div className="dashboard-heading-actions"><Link className="button button-quiet" to="/leads">Manage leads</Link><Link className="button" to="/new-listing">Add a listing +</Link></div></div>{error && <p className="error-banner" role="alert">{error}</p>}<div className="analytics-title-row"><div><h2 className="analytics-heading">Listing performance</h2><p className="analytics-caption">Lifetime totals; daily trends start collecting now.</p></div><div className="analytics-period" role="group" aria-label="Activity trend period"><button type="button" className={period === 7 ? 'selected' : ''} aria-pressed={period === 7} onClick={() => setPeriod(7)}>7 days</button><button type="button" className={period === 30 ? 'selected' : ''} aria-pressed={period === 30} onClick={() => setPeriod(30)}>30 days</button></div></div><div className="dashboard-stats analytics-stats"><div><span>Available listings</span><b>{items.filter((property) => property.status === 'sale').length}</b></div><div><span>Views</span><b>{analytics.summary.views}</b><Sparkline values={trendValues('views')} label={`Views over ${period} days`} tone="spark-views"/><small>Daily · {period} days</small></div><div><span>Saved by buyers</span><b>{analytics.summary.saves}</b><Sparkline values={trendValues('saves')} label={`New saves over ${period} days`} tone="spark-saves"/><small>Daily · {period} days</small></div><div><span>Conversations</span><b>{analytics.summary.conversations}</b><Sparkline values={trendValues('conversations')} label={`New conversations over ${period} days`} tone="spark-conversations"/><small>Daily · {period} days</small></div><div><span>Viewing requests</span><b>{analytics.summary.viewings}</b><Sparkline values={trendValues('viewings')} label={`New viewing requests over ${period} days`} tone="spark-viewings"/><small>{analytics.summary.pendingViewings} pending</small></div></div><div className="seller-list-heading"><h2>Your listings</h2><span>{items.filter((property) => ['sold', 'rented'].includes(property.status)).length} sold or rented</span></div>{items.length ? <div className="seller-list">{items.map((property) => { const stats = listingAnalytics.get(String(property._id)) || { views: property.views || 0, saves: 0, conversations: 0, viewings: 0, pendingViewings: 0 }; const freshness = availabilityInfo(property); return <div className="seller-row" key={property._id}><div className="row-thumb">{property.images?.[0] ? <img src={property.images[0]} alt=""/> : '⌂'}</div><div className="row-main"><b>{property.title}</b><span className="muted">{property.area}, {property.city} · {money(property.price)}{property.purpose === 'rent' ? ' / month' : ''}</span>{freshness.label && <span className={`availability-freshness${freshness.stale ? ' needs-confirmation' : ''}`}>{freshness.label}</span>}<span className="listing-metrics"><span>{stats.views} views</span><span>{stats.saves} saves</span><span>{stats.conversations} conversations</span><span>{stats.viewings} viewings{stats.pendingViewings > 0 ? ` · ${stats.pendingViewings} pending` : ''}</span></span></div><div className="availability-control"><span>Status</span><select aria-label={`Availability for ${property.title}`} disabled={busyId === property._id} value={property.status || 'sale'} onChange={(event) => updateStatus(property, event.target.value)}><option value="sale">Available</option>{property.purpose === 'rent' ? <option value="rented">Rented</option> : <option value="sold">Sold</option>}<option value="unavailable">Unavailable</option></select>{property.status === 'sale' && <button className="confirm-availability-button" type="button" disabled={busyId === property._id} onClick={() => confirmAvailability(property)}>{busyId === property._id ? 'Saving…' : 'Confirm availability'}</button>}</div><Link className="text-link" to={`/edit-listing/${property._id}`}>Edit</Link><button className="button button-quiet" onClick={() => remove(property)}>Delete</button></div>; })}</div> : <div className="empty-state">No listings yet. Add your first home when you’re ready.</div>}</section>;
}
function LocationMapPicker({ latitude, longitude, center, onChange }) {
  const mapRef = useRef(null);
  const dragging = useRef(false);
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) {
    return <p className="location-map-hint">Find a map pin or enter both coordinates to preview and adjust the location.</p>;
  }
  const mapLat = center?.latitude ?? lat;
  const mapLon = center?.longitude ?? lon;
  const latDelta = 0.009;
  const lonDelta = Math.min(0.025 / Math.max(Math.cos(mapLat * Math.PI / 180), 0.25), 0.12);
  const south = Math.max(-85, mapLat - latDelta);
  const north = Math.min(85, mapLat + latDelta);
  const west = Math.max(-180, mapLon - lonDelta);
  const east = Math.min(180, mapLon + lonDelta);
  const mercator = (value) => Math.log(Math.tan(Math.PI / 4 + value * Math.PI / 360));
  const mercatorSouth = mercator(south);
  const mercatorNorth = mercator(north);
  const markerX = (lon - west) / (east - west) * 100;
  const markerY = (mercatorNorth - mercator(lat)) / (mercatorNorth - mercatorSouth) * 100;
  const placePin = (clientX, clientY) => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const nextLon = west + x * (east - west);
    const mercatorY = mercatorNorth - y * (mercatorNorth - mercatorSouth);
    const nextLat = (2 * Math.atan(Math.exp(mercatorY)) - Math.PI / 2) * 180 / Math.PI;
    onChange(Number(nextLat.toFixed(6)), Number(nextLon.toFixed(6)));
  };
  const moveWithKeyboard = (event) => {
    const steps = { ArrowUp: [0.0002, 0], ArrowDown: [-0.0002, 0], ArrowLeft: [0, -0.0002], ArrowRight: [0, 0.0002] };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    onChange(Number(Math.max(-85, Math.min(85, lat + step[0])).toFixed(6)), Number(Math.max(-180, Math.min(180, lon + step[1])).toFixed(6)));
  };
  const bbox = `${west},${south},${east},${north}`;
  return <div ref={mapRef} className="location-map-preview" role="group" aria-label="Property map location. Click the map or drag the pin to adjust it." onClick={(event) => placePin(event.clientX, event.clientY)}>
    <iframe title="OpenStreetMap location preview" loading="lazy" tabIndex="-1" src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`} />
    <button type="button" className="location-map-pin" style={{ left: `${markerX}%`, top: `${markerY}%` }} aria-label={`Map pin at latitude ${lat.toFixed(5)}, longitude ${lon.toFixed(5)}. Drag to move or use arrow keys.`} title="Drag to adjust the property location" onClick={(event) => event.stopPropagation()} onKeyDown={moveWithKeyboard} onPointerDown={(event) => { event.stopPropagation(); dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (dragging.current) placePin(event.clientX, event.clientY); }} onPointerUp={(event) => { dragging.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { dragging.current = false; }}>
      <span aria-hidden="true" />
    </button>
    <button type="button" className="location-map-reposition" onClick={(event) => { event.stopPropagation(); const rect = mapRef.current?.getBoundingClientRect(); if (rect) placePin(rect.left + rect.width / 2, rect.top + rect.height / 2); }}>Place pin at map center</button>
    <small className="location-map-attribution">© OpenStreetMap contributors · Click the map or drag the pin</small>
  </div>;
}

function ListingForm({ edit = false }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', price: '', purpose: 'sale', city: '', area: '', pincode: '', latitude: '', longitude: '', locationPrecision: 'approximate', propertyType: 'flat', bhk: '', bathrooms: '', areaSize: '', furnishing: 'unfurnished', status: 'sale', images: [], imageFiles: [] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [mapCenter, setMapCenter] = useState(null);

  useEffect(() => {
    if (edit) api.get(`/api/property/mine/${id}`).then(({ data }) => {
      const images = data.property.images || [];
      setForm((current) => ({ ...current, ...data.property, locationPrecision: data.property.locationPrecision || 'approximate', images, imageFiles: data.property.imageFiles || [] }));
      if (data.property.latitude != null && data.property.longitude != null) setMapCenter({ latitude: Number(data.property.latitude), longitude: Number(data.property.longitude) });
    }).catch(() => setError('Listing could not be found'));
  }, [edit, id]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value, ...(['area', 'city', 'pincode'].includes(name) ? { latitude: '', longitude: '' } : {}), ...(name === 'purpose' && value === 'rent' ? { status: 'sale' } : {}) }));
    if (['area', 'city', 'pincode'].includes(name)) { setMapCenter(null); setLocationMessage(''); }
  };
  const locateProperty = async () => {
    const query = [form.area, form.city, form.pincode].filter(Boolean).join(', ');
    if (!query) { setLocationMessage('Enter an area, city and PIN code first.'); return; }
    setLocationBusy(true); setLocationMessage('');
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Location lookup is unavailable.');
      const results = await response.json();
      if (!results.length) { setLocationMessage('Could not find that location. Add a more specific area or PIN code.'); return; }
      const latitude = Number(results[0].lat);
      const longitude = Number(results[0].lon);
      setForm((current) => ({ ...current, latitude, longitude }));
      setMapCenter({ latitude, longitude });
      setLocationMessage('Map location found. Click the preview or drag its pin to refine the placement.');
    } catch (requestError) { setLocationMessage(requestError.message || 'Could not find the map location.'); }
    finally { setLocationBusy(false); }
  };
  const uploadImages = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (files.length > 8 - form.images.length) {
      setError(`Choose up to ${8 - form.images.length} more photo${8 - form.images.length === 1 ? '' : 's'}.`);
      event.target.value = '';
      return;
    }
    const body = new FormData();
    files.forEach((file) => body.append('images', file));
    setUploading(true);
    setError('');
    try {
      const { data } = await api.post('/api/property/images', body);
      setForm((current) => ({ ...current, images: [...current.images, ...data.images.map((image) => image.url)], imageFiles: [...current.imageFiles, ...data.images.map((image) => image.filename)] }));
      setNewImageFiles((current) => [...current, ...data.images.map((image) => image.filename)]);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save photos to the backend.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };
  const removeImage = async (index) => {
    const filename = form.imageFiles[index];
    if (filename && newImageFiles.includes(filename)) {
      try { await api.delete('/api/property/images', { data: { filenames: [filename] } }); }
      catch (e) { setError(e.response?.data?.message || 'Could not remove uploaded photo.'); return; }
      setNewImageFiles((current) => current.filter((file) => file !== filename));
    }
    setForm((current) => ({ ...current, images: current.images.filter((_, imageIndex) => imageIndex !== index), imageFiles: current.imageFiles.filter((_, imageIndex) => imageIndex !== index) }));
  };
  const submit = async (event) => {
    event.preventDefault();
    const hasLatitude = form.latitude !== '' && form.latitude !== null && form.latitude !== undefined;
    const hasLongitude = form.longitude !== '' && form.longitude !== null && form.longitude !== undefined;
    if (hasLatitude !== hasLongitude) { setError('Enter both latitude and longitude, or clear both coordinates.'); return; }
    if (form.locationPrecision === 'exact' && !hasLatitude) { setError('Find a map pin before sharing an exact location.'); return; }
    setBusy(true);
    setError('');
    try {
      const payload = { ...form };
      if (hasLatitude) { payload.latitude = Number(payload.latitude); payload.longitude = Number(payload.longitude); }
      else { payload.latitude = null; payload.longitude = null; }
      await api[edit ? 'patch' : 'post'](edit ? `/api/property/${id}` : '/api/property', payload);
      nav('/dashboard');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save listing');
    } finally {
      setBusy(false);
    }
  };

  return <section className="page-wrap form-wrap">
    <span className="eyebrow">Seller tools</span><h1>{edit ? 'Edit your listing' : 'Tell us about your place'}</h1>
    <p className="muted">A few useful details help the right people find this home.</p>
    <form className="listing-form" onSubmit={submit}>
      <label>Listing title<input required name="title" value={form.title} onChange={update} placeholder="A bright apartment near the park"/></label>
      <label>Description<textarea required rows="5" name="description" value={form.description} onChange={update}/></label>
      <div className="photo-upload-field"><label htmlFor="property-photos">Property photos</label><p id="photo-help">JPG, PNG, WebP, or AVIF. Up to 8 photos, 8 MB each.</p><input id="property-photos" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={uploadImages} disabled={uploading || form.images.length >= 8}/>{uploading && <p role="status" className="upload-status">Uploading photos…</p>}{form.images.length > 0 && <div className="photo-grid">{form.images.map((url, index) => <figure key={url}><img src={url} alt={`Property photo ${index + 1}`}/><button type="button" className="remove-photo" aria-label={`Remove property photo ${index + 1}`} onClick={() => removeImage(index)}>Remove</button></figure>)}</div>}</div>
      <div className="form-grid">
    <label>{form.purpose === 'rent' ? 'Monthly rent (INR)' : 'Price (INR)'}<input required min="1" type="number" name="price" value={form.price} onChange={update}/></label>
        <label>Listing purpose<select name="purpose" value={form.purpose} onChange={update}><option value="sale">For sale</option><option value="rent">For rent</option></select></label>
        <label>Property type<select name="propertyType" value={form.propertyType} onChange={update}>{['flat','apartment','villa','house','studio','penthouse','office','townhouse','plot','commercial'].map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
        <label>City<input required name="city" value={form.city} onChange={update}/></label>
        <label>Area / neighborhood<input required name="area" value={form.area} onChange={update}/></label>
        <label>PIN code<input required name="pincode" value={form.pincode} onChange={update}/></label>
        <div className="coordinate-field">
          <span>Public map location</span>
          <label className="location-precision-choice">Pin precision<select name="locationPrecision" value={form.locationPrecision || 'approximate'} onChange={update}><option value="approximate">Approximate neighborhood</option><option value="exact">Exact location</option></select></label>
          <small className="location-precision-help">Approximate is recommended for homes. It rounds the public map pin to neighborhood level; exact shares the coordinates you choose.</small>
          <button type="button" className="button button-quiet button-small" onClick={locateProperty} disabled={locationBusy}>{locationBusy ? 'Finding location…' : form.latitude !== '' && form.longitude !== '' ? 'Refresh map pin' : 'Find map pin'}</button>
          <div className="coordinate-inputs">
            <label>Latitude<input type="number" name="latitude" min="-90" max="90" step="any" value={form.latitude ?? ''} onChange={update} onBlur={() => { const latitude = Number(form.latitude); const longitude = Number(form.longitude); if (Number.isFinite(latitude) && Number.isFinite(longitude)) setMapCenter({ latitude, longitude }); }} placeholder="Optional"/></label>
            <label>Longitude<input type="number" name="longitude" min="-180" max="180" step="any" value={form.longitude ?? ''} onChange={update} onBlur={() => { const latitude = Number(form.latitude); const longitude = Number(form.longitude); if (Number.isFinite(latitude) && Number.isFinite(longitude)) setMapCenter({ latitude, longitude }); }} placeholder="Optional"/></label>
          </div>
          {form.latitude !== '' && form.longitude !== '' && <LocationMapPicker latitude={form.latitude} longitude={form.longitude} center={mapCenter} onChange={(latitude, longitude) => setForm((current) => ({ ...current, latitude, longitude }))}/>}
          {locationMessage && <p className="muted" role="status">{locationMessage}</p>}
          <small>Used to place this listing on the search map. Lookup uses OpenStreetMap.</small>
        </div>
        <label>Bedrooms<input name="bhk" value={form.bhk} onChange={update}/></label>
        <label>Bathrooms<input min="0" type="number" name="bathrooms" value={form.bathrooms} onChange={update}/></label>
        <label>Area (sq ft)<input min="0" type="number" name="areaSize" value={form.areaSize} onChange={update}/></label>
        <label>Furnishing<select name="furnishing" value={form.furnishing} onChange={update}><option value="unfurnished">Unfurnished</option><option value="semi-furnished">Semi-furnished</option><option value="furnished">Furnished</option></select></label>
        {form.purpose === 'sale' && <label>Availability<select name="status" value={form.status} onChange={update}><option value="sale">Available</option><option value="sold">Sold</option></select></label>}
      </div>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <button className="button" disabled={busy || uploading}>{busy ? 'Saving…' : 'Save listing'}</button> <Link className="text-link" to="/dashboard">Cancel</Link>
    </form>
  </section>;
}
function ChatPage() {
  const { id } = useParams(); const auth = useAuth(); const [chat, setChat] = useState(null); const [text, setText] = useState(''); const [error, setError] = useState(''); const [sending, setSending] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const { data } = await api.get(`/api/chats/${id}`); if (active) { setChat(data.chat); setError(''); await api.post(`/api/chats/${id}/read`); } }
      catch (e) { if (active) setError(e.response?.data?.message || 'Could not load conversation'); }
    };
    const controller = new AbortController();
    refresh();
    watchChatUpdates((event) => { if (event.chatId === id) refresh(); }, controller.signal);
    const timer = setInterval(refresh, 20000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, [id]);
  const send = async (event) => { event.preventDefault(); if (!text.trim()) return; setSending(true); try { const { data } = await api.post(`/api/chats/${id}/messages`, { text }); setChat(data.chat); setText(''); setError(''); } catch (e) { setError(e.response?.data?.message || 'Could not send message'); } finally { setSending(false); } };
  if (error && !chat) return <section className="page-wrap"><p className="error-banner">{error}</p><Link to="/properties">Back to homes</Link></section>;
  if (!chat) return <p className="loading">Opening conversation…</p>;
  const partner = String(chat.buyer?._id || chat.buyer) === String(auth.user._id) ? chat.seller : chat.buyer;
  return <section className="page-wrap chat-wrap"><Link className="text-link" to="/properties">← Browse homes</Link><div className="chat-panel"><div className="chat-title"><span className="eyebrow">Private conversation · updates automatically</span><h1>{partner?.name || 'Home owner'}</h1>{chat.property?.title && <p className="muted">Regarding {chat.property.title}</p>}</div><div className="chat-messages">{chat.messages.length ? chat.messages.map((message, index) => { const own = String(message.sender?._id || message.sender) === String(auth.user._id); return <div className={`chat-message ${own ? 'message-own' : ''}`} key={message._id || index}><span>{own ? 'You' : partner?.name || 'Home owner'}{own && message.readAt ? ' · Read' : ''}</span><p>{message.text}</p></div>; }) : <p className="chat-empty">Start the conversation with a message about this property.</p>}</div>{error && <p className="error-banner">{error}</p>}<form className="chat-compose" onSubmit={send}><label className="sr-only" htmlFor="chat-message">Your message</label><input id="chat-message" maxLength="4000" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…"/><button className="button" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send'}</button></form></div></section>;
}
function MessagesInbox() {
  const auth = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => api.get('/api/chats').then(({ data }) => { if (active) setChats(data.chats); }).catch((e) => { if (active) setError(e.response?.data?.message || 'Could not load conversations'); }).finally(() => { if (active) setLoading(false); });
    const controller = new AbortController();
    refresh();
    watchChatUpdates(refresh, controller.signal);
    const timer = setInterval(refresh, 30000);
    return () => { active = false; controller.abort(); clearInterval(timer); };
  }, []);
  return <section className="page-wrap inbox-wrap"><div className="page-intro"><span className="eyebrow">Your conversations</span><h1>Messages</h1><p>Continue a conversation about a property.</p></div>{error && <p className="error-banner" role="alert">{error}</p>}{loading ? <p className="loading" role="status">Loading conversations…</p> : chats.length ? <div className="inbox-list">{chats.map((chat) => { const partner = String(chat.buyer?._id) === String(auth.user._id) ? chat.seller : chat.buyer; const lastMessage = chat.messages?.at(-1); const unread = (chat.messages || []).filter((message) => String(message.sender?._id || message.sender) !== String(auth.user._id) && !message.readAt).length; return <Link className="inbox-item" key={chat._id} to={`/messages/${chat._id}`}><span className="inbox-avatar" aria-hidden="true">{partner?.name?.charAt(0)?.toUpperCase() || 'H'}</span><span className="inbox-main"><strong>{partner?.name || 'Home owner'}</strong><span>{chat.property?.title || 'Property conversation'}</span><small>{unread > 0 && <b className="unread-count">{unread} unread · </b>}{lastMessage?.text || 'No messages yet'}</small></span><time dateTime={chat.updatedAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(chat.updatedAt))}</time></Link>; })}</div> : <div className="empty-state"><h2>No conversations yet</h2><p>When you contact a seller, your conversations will appear here.</p><Link className="button" to="/properties">Explore homes</Link></div>}</section>;
}

function SellerLeads() {
  const auth = useAuth();
  const [chats, setChats] = useState([]);
  const [viewings, setViewings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [kind, setKind] = useState('all');
  const [followUp, setFollowUp] = useState('all');
  const [propertyId, setPropertyId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => Promise.all([api.get('/api/chats'), api.get('/api/viewings'), api.get('/api/property/mine')])
      .then(([chatResponse, viewingResponse, propertyResponse]) => {
        if (!active) return;
        setChats(chatResponse.data.chats);
        setViewings(viewingResponse.data.viewings);
        setProperties(propertyResponse.data.properties);
        setError('');
      })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load seller leads.'); })
      .finally(() => { if (active) setLoading(false); });
    const controller = new AbortController();
    refresh();
    watchChatUpdates(refresh, controller.signal);
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, []);

  const updateViewing = async (viewing, status) => {
    setBusyId(viewing._id); setError(''); setMessage('');
    try {
      const { data } = await api.patch(`/api/viewings/${viewing._id}`, { status });
      setViewings((current) => current.map((item) => item._id === viewing._id ? { ...item, status: data.viewing.status, updatedAt: data.viewing.updatedAt } : item));
      setMessage(`Viewing request ${status}.`);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not update the viewing request.'); }
    finally { setBusyId(''); }
  };

  const leads = [
    ...chats.map((chat) => {
      const lastMessage = chat.messages?.at(-1);
      const needsAction = !lastMessage || String(lastMessage.sender?._id || lastMessage.sender) !== String(auth.user._id);
      return { id: `chat:${chat._id}`, chat, type: 'message', property: chat.property, buyer: chat.buyer, createdAt: lastMessage?.sentAt || chat.updatedAt, preview: lastMessage?.text || 'Conversation started. Send a welcome message.', needsAction, statusLabel: needsAction ? 'Needs reply' : 'Conversation' };
    }),
    ...viewings.map((viewing) => ({
      id: `viewing:${viewing._id}`, viewing, type: 'viewing', property: viewing.property, buyer: viewing.buyer,
      createdAt: viewing.updatedAt || viewing.createdAt,
      preview: `${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(viewing.requestedFor))}${viewing.note ? ` · ${viewing.note}` : ''}`,
      needsAction: viewing.status === 'pending', statusLabel: viewing.status === 'pending' ? 'Needs decision' : `Viewing ${viewing.status}`,
    })),
  ].filter((lead) => kind === 'all' || lead.type === kind)
    .filter((lead) => propertyId === 'all' || String(lead.property?._id) === propertyId)
    .filter((lead) => followUp === 'all' || (followUp === 'needs-action' ? lead.needsAction : !lead.needsAction))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return <section className="page-wrap leads-page">
    <div className="page-intro"><span className="eyebrow">Buyer activity</span><h1>Seller leads</h1><p>Messages and viewing requests for your listings, together in one place.</p></div>
    <div className="leads-summary"><div><span>Conversations</span><b>{chats.length}</b></div><div><span>Pending viewings</span><b>{viewings.filter((item) => item.status === 'pending').length}</b></div><Link className="button button-quiet button-small" to="/messages">All messages ↗</Link></div>
    <div className="leads-filters">
      <label>Listing<select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="all">All listings</option>{properties.map((property) => <option key={property._id} value={property._id}>{property.title}</option>)}</select></label>
      <label>Activity<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Messages and viewings</option><option value="message">Messages</option><option value="viewing">Viewing requests</option></select></label>
      <label>Follow-up<select value={followUp} onChange={(event) => setFollowUp(event.target.value)}><option value="all">All activity</option><option value="needs-action">Needs action</option><option value="handled">Handled</option></select></label>
    </div>
    {error && <p className="error-banner" role="alert">{error}</p>}{message && <p className="success-banner" role="status">{message}</p>}
    {loading ? <p className="loading" role="status">Gathering buyer activity…</p> : leads.length ? <div className="lead-list">{leads.map((lead) => <article className="lead-item" key={lead.id}>
      <span className="lead-avatar" aria-hidden="true">{lead.buyer?.name?.charAt(0)?.toUpperCase() || 'B'}</span>
      <div className="lead-main"><div className="lead-title"><strong>{lead.buyer?.name || 'Buyer'}</strong><span className={`lead-type lead-${lead.type}`}>{lead.type === 'message' ? 'Message' : 'Viewing'}</span><span className={`lead-status${lead.needsAction ? ' needs-action' : ''}`}>{lead.statusLabel}</span></div><Link className="lead-property" to={lead.property?._id ? `/properties/${lead.property._id}` : '/dashboard'}>{lead.property?.title || 'Property conversation'}</Link><p>{lead.preview}</p></div>
      <time dateTime={lead.createdAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(lead.createdAt))}</time>
      <div className="lead-actions">{lead.type === 'message' ? <Link className="button button-small" to={`/messages/${lead.chat._id}`}>Open conversation</Link> : lead.viewing.status === 'pending' ? <><button className="button button-small" disabled={busyId === lead.viewing._id} onClick={() => updateViewing(lead.viewing, 'accepted')}>Accept</button><button className="button button-quiet button-small" disabled={busyId === lead.viewing._id} onClick={() => updateViewing(lead.viewing, 'declined')}>Decline</button></> : <Link className="text-link" to="/viewings">View request</Link>}</div>
    </article>)}</div> : <div className="empty-state"><h2>{chats.length || viewings.length ? 'No leads match these filters' : 'No buyer activity yet'}</h2><p>{chats.length || viewings.length ? 'Try another listing or follow-up filter.' : 'Buyer messages and viewing requests will appear here.'}</p>{(kind !== 'all' || followUp !== 'all' || propertyId !== 'all') && <button className="button button-quiet" onClick={() => { setKind('all'); setFollowUp('all'); setPropertyId('all'); }}>Clear filters</button>}</div>}
  </section>;
}

function NotificationsPage() {
  const { unreadCount, refreshNotifications } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = () => refreshNotifications().then((data) => setNotifications(data.notifications || [])).catch((requestError) => setError(requestError.response?.data?.message || 'Could not load notifications.')).finally(() => setLoading(false));
  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 45_000); return () => window.clearInterval(timer); }, []);
  const markAllRead = async () => {
    setBusy(true); setError('');
    try { await api.post('/api/notifications/read-all'); await refresh(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not mark notifications as read.'); }
    finally { setBusy(false); }
  };
  const icons = { message: '✉', viewing: '⌂', reminder: '◷', search: '⌕', report: '⚑' };
  return <section className="page-wrap notifications-page">
    <div className="page-intro"><span className="eyebrow">Your updates</span><div className="notifications-title-row"><div><h1>Notifications</h1><p>Messages, viewing updates and reminders, and new homes matching your saved searches.</p></div><button className="button button-quiet button-small" type="button" disabled={!unreadCount || busy} onClick={markAllRead}>{busy ? 'Marking read…' : 'Mark all as read'}</button></div></div>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {loading ? <p className="loading" role="status">Checking your updates…</p> : notifications.length ? <div className="notification-list">{notifications.map((notification) => <Link className={`notification-item${notification.unread ? ' is-unread' : ''}`} key={notification.id} to={notification.href}>
      <span className={`notification-icon notification-${notification.type}`} aria-hidden="true">{icons[notification.type] || '•'}</span>
      <span className="notification-copy"><strong>{notification.title}</strong><span>{notification.body}</span></span>
      <time dateTime={notification.createdAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(notification.createdAt))}</time>
      {notification.unread && <span className="notification-unread-dot" aria-label="Unread"/>}
    </Link>)}</div> : <div className="empty-state"><h2>You’re all caught up</h2><p>New messages, viewing updates, reminders, and search matches will appear here.</p></div>}
  </section>;
}

function ViewingsPage() {
  const auth = useAuth();
  const [viewings, setViewings] = useState([]);
  const [slots, setSlots] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('');
  const [slotDate, setSlotDate] = useState('');
  const [slotTime, setSlotTime] = useState('');
  const [slotMessage, setSlotMessage] = useState('');
  const [selectedDay, setSelectedDay] = useState(() => localDateKey(new Date()));
  const refresh = () => {
    const requests = [api.get('/api/viewings')];
    if (auth.user.role === 'seller') requests.push(api.get('/api/viewings/availability/mine'), api.get('/api/property/mine'));
    Promise.all(requests).then(([viewingResponse, slotResponse, propertyResponse]) => {
      setViewings(viewingResponse.data.viewings);
      if (slotResponse) setSlots(slotResponse.data.slots);
      if (propertyResponse) {
        const availableListings = propertyResponse.data.properties.filter((property) => property.purpose !== 'rent' && property.status === 'sale');
        setListings(availableListings);
        setSelectedProperty((current) => current || availableListings[0]?._id || '');
      }
      setError('');
    }).catch((requestError) => setError(requestError.response?.data?.message || 'Could not load viewing requests.')).finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const calendarDays = Array.from({ length: 14 }, (_, index) => { const day = new Date(today); day.setDate(day.getDate() + index); return day; });
  const dayKey = localDateKey;
  const dayEvents = [
    ...slots.filter((slot) => slot.status === 'available').map((slot) => ({ type: 'slot', startsAt: slot.startsAt, slot })),
    ...viewings.filter((viewing) => ['pending', 'accepted'].includes(viewing.status)).map((viewing) => ({ type: 'viewing', startsAt: viewing.requestedFor, viewing })),
  ].filter((event) => dayKey(event.startsAt) === selectedDay).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const eventCount = (day) => dayEventsFor(dayKey(day)).length;
  const dayEventsFor = (key) => [...slots.filter((slot) => slot.status === 'available' && dayKey(slot.startsAt) === key), ...viewings.filter((viewing) => ['pending', 'accepted'].includes(viewing.status) && dayKey(viewing.requestedFor) === key)];
  const addSlot = async (event) => {
    event.preventDefault(); setSlotMessage(''); setError('');
    try {
      const startsAt = new Date(`${slotDate}T${slotTime}`);
      const { data } = await api.post('/api/viewings/availability', { propertyId: selectedProperty, startsAt: startsAt.toISOString() });
      setSlotMessage('Viewing time added to your calendar.'); setSelectedDay(dayKey(data.slot.startsAt)); setSlotTime(''); refresh();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not add this viewing time.'); }
  };
  const removeSlot = async (slot) => {
    try { await api.delete(`/api/viewings/availability/${slot._id}`); setSlots((current) => current.filter((item) => item._id !== slot._id)); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not remove this time.'); }
  };
  const update = async (viewing, status) => {
    setBusyId(viewing._id); setError('');
    try { const { data } = await api.patch(`/api/viewings/${viewing._id}`, { status }); setViewings((current) => current.map((item) => item._id === viewing._id ? { ...item, ...data.viewing, property: item.property, buyer: item.buyer, seller: item.seller } : item)); if (auth.user.role === 'seller') refresh(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not update this request.'); }
    finally { setBusyId(''); }
  };
  const downloadCalendarEvent = async (viewing) => {
    setBusyId(viewing._id); setError('');
    try {
      const { data } = await api.get(`/api/viewings/${viewing._id}/calendar`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `tsuki-viewing-${localDateKey(viewing.requestedFor)}.ics`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not create a calendar event.'); }
    finally { setBusyId(''); }
  };
  const requestList = viewings.length ? <div className="viewing-list">{viewings.map((viewing) => { const other = auth.user.role === 'seller' ? viewing.buyer : viewing.seller; return <article className="viewing-item" key={viewing._id}><div className="viewing-thumb">{viewing.property?.images?.[0] && <img src={viewing.property.images[0]} alt=""/>}</div><div className="viewing-info"><Link to={`/properties/${viewing.property?._id}`}><strong>{viewing.property?.title || 'Listing unavailable'}</strong></Link><span>{viewing.property?.area}, {viewing.property?.city} · {money(viewing.property?.price || 0)}{viewing.property?.purpose === 'rent' ? ' / month' : ''}</span><span>{auth.user.role === 'seller' ? 'Requested by' : 'Seller'}: {other?.name || 'Tsuki member'}{other?.phone ? ` · ${other.phone}` : ''}</span>{viewing.note && <p>{viewing.note}</p>}</div><div className="viewing-actions"><time dateTime={viewing.requestedFor}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(viewing.requestedFor))}</time><span className={`viewing-status viewing-${viewing.status}`}>{viewing.status}</span>{viewing.status === 'accepted' && <button className="button button-quiet button-small" disabled={busyId === viewing._id} onClick={() => downloadCalendarEvent(viewing)}>Add to calendar</button>}{auth.user.role === 'seller' && viewing.status === 'pending' && <div><button className="button button-small" disabled={busyId === viewing._id} onClick={() => update(viewing, 'accepted')}>Accept</button><button className="button button-quiet button-small" disabled={busyId === viewing._id} onClick={() => update(viewing, 'declined')}>Decline</button></div>}{auth.user.role === 'buyer' && ['pending', 'accepted'].includes(viewing.status) && <div><button className="button button-quiet button-small" disabled={busyId === viewing._id} onClick={() => update(viewing, 'cancelled')}>Cancel viewing</button></div>}</div></article>; })}</div> : <div className="empty-state"><h2>No viewing requests yet</h2><p>{auth.user.role === 'seller' ? 'Buyer requests will appear here.' : 'Request a visit from a property page to get started.'}</p><Link className="button" to="/properties">Explore homes</Link></div>;
  return <section className="page-wrap viewings-page"><div className="page-intro"><span className="eyebrow">Property visits</span><h1>{auth.user.role === 'seller' ? 'Viewing calendar' : 'Viewing requests'}</h1><p>{auth.user.role === 'seller' ? 'Set open times for buyers and manage confirmed visits.' : 'Track your requested property viewings.'}</p></div>{error && <p className="error-banner" role="alert">{error}</p>}{loading ? <p className="loading" role="status">Loading viewing requests…</p> : <>
    {auth.user.role === 'seller' && <>
      <section className="slot-manager"><div className="slot-manager-heading"><div><span className="eyebrow">Seller availability</span><h2>Add an open time</h2><p>Slots are 30 minutes and become unavailable when a buyer requests them.</p></div></div>{slotMessage && <p className="success-banner" role="status">{slotMessage}</p>}{listings.length ? <form className="slot-create-form" onSubmit={addSlot}><label>Listing<select value={selectedProperty} onChange={(event) => setSelectedProperty(event.target.value)} required>{listings.map((property) => <option key={property._id} value={property._id}>{property.title}</option>)}</select></label><label>Date<input type="date" required min={localDateKey(today)} max={localDateKey(calendarDays[13])} value={slotDate} onChange={(event) => setSlotDate(event.target.value)} /></label><label>Start time<select required value={slotTime} onChange={(event) => setSlotTime(event.target.value)}><option value="">Choose a time</option>{Array.from({ length: 24 }, (_, index) => { const hour = Math.floor(index / 2) + 8; const minute = index % 2 ? '30' : '00'; const value = `${String(hour).padStart(2, '0')}:${minute}`; return <option key={value} value={value}>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(`2000-01-01T${value}:00`))}</option>; })}</select></label><button className="button" disabled={!selectedProperty || !slotDate || !slotTime}>Add to calendar</button></form> : <p className="muted">Create an available sale listing before adding viewing times.</p>}</section>
      <div className="viewing-calendar"><div className="calendar-heading"><h2>Next 14 days</h2><span>Local time</span></div><div className="calendar-days" role="group" aria-label="Choose a day"><div className="calendar-day-scroll">{calendarDays.map((day) => { const key = dayKey(day); return <button type="button" key={key} className={`calendar-day${selectedDay === key ? ' selected' : ''}`} aria-pressed={selectedDay === key} onClick={() => setSelectedDay(key)}><span>{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong><small>{eventCount(day)} {eventCount(day) === 1 ? 'event' : 'events'}</small></button>; })}</div></div><div className="calendar-agenda"><h3>{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${selectedDay}T12:00:00`))}</h3>{dayEvents.length ? <div className="calendar-events">{dayEvents.map((event) => event.type === 'slot' ? <article className="calendar-event calendar-open-slot" key={event.slot._id}><time>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(event.startsAt))}</time><div><strong>Open viewing time</strong><span>{event.slot.property?.title || 'Your listing'}</span></div><span className="viewing-status">Available</span><button className="button button-quiet button-small" onClick={() => removeSlot(event.slot)}>Remove</button></article> : <article className="calendar-event calendar-booked-slot" key={event.viewing._id}><time>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(event.startsAt))}</time><div><strong>{event.viewing.property?.title || 'Listing unavailable'}</strong><span>{event.viewing.status === 'pending' ? `Requested by ${event.viewing.buyer?.name || 'a buyer'}` : `${event.viewing.status[0].toUpperCase()}${event.viewing.status.slice(1)} · ${event.viewing.buyer?.name || 'Buyer'}`}</span></div><span className={`viewing-status viewing-${event.viewing.status}`}>{event.viewing.status}</span></article>)}</div> : <p className="empty-calendar-day">Nothing scheduled. Add an open time above.</p>}</div></div>
      <section className="viewing-requests-section"><div className="calendar-heading"><h2>All requests</h2><span>{viewings.filter((viewing) => viewing.status === 'pending').length} pending</span></div>{viewings.length ? requestList : <p className="empty-calendar-day">Buyer requests will appear here.</p>}</section>
    </>}
    {auth.user.role === 'buyer' && <>
      <div className="viewing-calendar"><div className="calendar-heading"><h2>Your next 14 days</h2><span>Confirmed visits appear here automatically</span></div><div className="calendar-days" role="group" aria-label="Choose a day"><div className="calendar-day-scroll">{calendarDays.map((day) => { const key = dayKey(day); const count = viewings.filter((viewing) => ['pending', 'accepted'].includes(viewing.status) && dayKey(viewing.requestedFor) === key).length; return <button type="button" key={key} className={`calendar-day${selectedDay === key ? ' selected' : ''}`} aria-pressed={selectedDay === key} onClick={() => setSelectedDay(key)}><span>{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong><small>{count} {count === 1 ? 'visit' : 'visits'}</small></button>; })}</div></div><div className="calendar-agenda"><h3>{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${selectedDay}T12:00:00`))}</h3>{viewings.filter((viewing) => ['pending', 'accepted'].includes(viewing.status) && dayKey(viewing.requestedFor) === selectedDay).sort((a, b) => new Date(a.requestedFor) - new Date(b.requestedFor)).length ? <div className="calendar-events">{viewings.filter((viewing) => ['pending', 'accepted'].includes(viewing.status) && dayKey(viewing.requestedFor) === selectedDay).sort((a, b) => new Date(a.requestedFor) - new Date(b.requestedFor)).map((viewing) => <article className="calendar-event calendar-booked-slot" key={viewing._id}><time>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(viewing.requestedFor))}</time><div><strong>{viewing.property?.title || 'Listing unavailable'}</strong><span>{viewing.property?.area}, {viewing.property?.city}</span></div><span className={`viewing-status viewing-${viewing.status}`}>{viewing.status}</span>{viewing.status === 'accepted' && <button className="button button-quiet button-small" disabled={busyId === viewing._id} onClick={() => downloadCalendarEvent(viewing)}>Add to calendar</button>}</article>)}</div> : <p className="empty-calendar-day">No visits scheduled for this day.</p>}</div></div>
      {viewings.length ? requestList : <div className="empty-state"><h2>No viewing requests yet</h2><p>Request a visit from a property page to get started.</p><Link className="button" to="/properties">Explore homes</Link></div>}
    </>}
  </>}</section>;
}

function SavedSearchAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = () => api.get('/api/search-alerts').then(({ data }) => setAlerts(data.alerts)).catch((requestError) => setError(requestError.response?.data?.message || 'Could not load search alerts.')).finally(() => setLoading(false));
  useEffect(() => { refresh(); }, []);
  const remove = async (alertId) => { try { await api.delete(`/api/search-alerts/${alertId}`); setAlerts((current) => current.filter((alert) => alert._id !== alertId)); } catch (requestError) { setError(requestError.response?.data?.message || 'Could not remove this alert.'); } };
  return <section className="page-wrap saved-alerts-page"><div className="page-intro"><span className="eyebrow">New matches</span><h1>Search alerts</h1><p>New homes that match your saved searches appear here.</p></div>{error && <p className="error-banner" role="alert">{error}</p>}{loading ? <p className="loading" role="status">Checking saved searches…</p> : alerts.length ? <div className="saved-alert-list">{alerts.map((alert) => <section className="saved-alert" key={alert._id}><div className="saved-alert-heading"><div><h2>{alert.name}</h2><p className="muted">Saved {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(alert.createdAt))}</p></div><button className="button button-quiet button-small" onClick={() => remove(alert._id)}>Remove alert</button></div>{alert.matches.length ? <><p className="alert-match-count">{alert.matches.length} new {alert.matches.length === 1 ? 'match' : 'matches'}</p><div className="property-grid">{alert.matches.map((property) => <PropertyCard key={property._id} property={property}/>)}</div></> : <p className="empty-alert">No new matches yet. We’ll show matching listings added after this search was saved.</p>}</section>)}</div> : <div className="empty-state"><h2>No saved searches</h2><p>Save filters from the property search page to get new listing alerts here.</p><Link className="button" to="/properties">Find homes</Link></div>}</section>;
}

function SavedHomes() {
  const { savedIds } = usePropertyTools();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.get('/api/favorites').then(({ data }) => { if (active) setProperties(data.properties); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load saved homes.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [savedIds.join(',')]);
  return <section className="page-wrap saved-page"><div className="page-intro"><span className="eyebrow">Your shortlist</span><h1>Saved homes</h1><p>Keep the places you’re considering together.</p></div>{error && <p className="error-banner" role="alert">{error}</p>}{loading ? <p className="loading" role="status">Loading saved homes…</p> : properties.length ? <div className="property-grid">{properties.map((property) => <PropertyCard key={property._id} property={property}/>)}</div> : <div className="empty-state"><h2>No saved homes yet</h2><p>Save a listing with the heart button and it’ll appear here.</p><Link className="button" to="/properties">Explore homes</Link></div>}</section>;
}

function CompareHomes() {
  const { comparisonIds, toggleComparison, setComparisonIds } = usePropertyTools();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!comparisonIds.length) { setProperties([]); setLoading(false); return undefined; }
    let active = true;
    setLoading(true);
    setError('');
    api.get('/api/property/compare', { params: { ids: comparisonIds.join(',') } })
      .then(({ data }) => { if (active) setProperties(data.properties); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Could not load homes to compare.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [comparisonIds.join(',')]);
  const remove = (id) => {
    toggleComparison(id);
    setProperties((current) => current.filter((property) => String(property._id) !== String(id)));
  };
  const rows = [
    ['Price', (property) => `${money(property.price)}${property.purpose === 'rent' ? ' / month' : ''}`],
    ['Purpose', (property) => property.purpose === 'rent' ? 'For rent' : property.status === 'sold' ? 'Sold' : 'For sale'],
    ['Property type', (property) => property.propertyType],
    ['Location', (property) => [property.area, property.city, property.pincode].filter(Boolean).join(', ')],
    ['Bedrooms', (property) => property.bhk ? `${property.bhk} BHK` : '—'],
    ['Bathrooms', (property) => property.bathrooms || '—'],
    ['Area', (property) => property.areaSize ? `${property.areaSize.toLocaleString()} sq ft` : '—'],
    ['Furnishing', (property) => property.furnishing || '—'],
    ['Amenities', (property) => property.amenities?.length ? property.amenities.join(', ') : '—'],
    ['Seller', (property) => property.seller?.name || '—'],
  ];
  return <section className="page-wrap compare-page"><div className="page-intro"><span className="eyebrow">Make a considered choice</span><h1>Compare homes</h1><p>Review the details side by side. Select up to four listings to compare.</p></div>{error && <p className="error-banner" role="alert">{error}</p>}{loading ? <p className="loading" role="status">Loading homes…</p> : properties.length ? <><div className="compare-toolbar"><span>{properties.length} of 4 homes selected</span><button className="text-link compare-clear" type="button" onClick={() => { setComparisonIds([]); setProperties([]); }}>Clear comparison</button></div><div className="compare-table-wrap"><table className="compare-table"><thead><tr><th scope="col">Property details</th>{properties.map((property) => <th scope="col" key={property._id}><div className="compare-property-head"><Link to={`/properties/${property._id}`}><img src={property.images?.[0]} alt=""/><strong>{property.title}</strong></Link><button type="button" onClick={() => remove(property._id)} aria-label={`Remove ${property.title} from comparison`}>Remove</button></div></th>)}</tr></thead><tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{properties.map((property) => <td key={property._id}>{value(property)}</td>)}</tr>)}</tbody></table></div></> : <div className="empty-state"><h2>Add homes to compare</h2><p>Use “Compare” on any listing to see prices, locations and features side by side.</p><Link className="button" to="/properties">Explore homes</Link></div>}</section>;
}

function Protected({children,role,allowPasswordChange=false}) { const auth=useAuth();if(!auth?.user)return <Navigate to="/login" replace/>;if(auth.user.mustChangePassword&&!allowPasswordChange)return <Navigate to="/profile" replace/>;if(role&&auth.user.role!==role)return <Navigate to="/properties" replace/>;return children; }
function App() { return <AuthProvider><NotificationProvider><PropertyToolsProvider><BrowserRouter><Layout><Routes><Route path="/" element={<Home/>}/><Route path="/properties" element={<Properties/>}/><Route path="/properties/:id" element={<PropertyDetail/>}/><Route path="/sellers/:id" element={<SellerProfile/>}/><Route path="/saved" element={<Protected role="buyer"><SavedHomes/></Protected>}/><Route path="/alerts" element={<Protected role="buyer"><SavedSearchAlerts/></Protected>}/><Route path="/leads" element={<Protected role="seller"><SellerLeads/></Protected>}/><Route path="/notifications" element={<Protected><NotificationsPage/></Protected>}/><Route path="/viewings" element={<Protected><ViewingsPage/></Protected>}/><Route path="/compare" element={<CompareHomes/>}/><Route path="/login" element={<Account/>}/><Route path="/register" element={<Account register/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/profile" element={<Protected allowPasswordChange><Profile/></Protected>}/><Route path="/contact" element={<Contact/>}/><Route path="/admin" element={<Protected role="admin"><AdminDashboard/></Protected>}/><Route path="/admin/users" element={<Protected role="admin"><AdminDashboard/></Protected>}/><Route path="/admin/properties" element={<Protected role="admin"><AdminDashboard/></Protected>}/><Route path="/admin/contacts" element={<Protected role="admin"><AdminDashboard/></Protected>}/><Route path="/admin/reports" element={<Protected role="admin"><AdminDashboard/></Protected>}/><Route path="/dashboard" element={<Protected role="seller"><Dashboard/></Protected>}/><Route path="/messages" element={<Protected><MessagesInbox/></Protected>}/><Route path="/messages/:id" element={<Protected><ChatPage/></Protected>}/><Route path="/new-listing" element={<Protected role="seller"><ListingForm/></Protected>}/><Route path="/edit-listing/:id" element={<Protected role="seller"><ListingForm edit/></Protected>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Layout></BrowserRouter></PropertyToolsProvider></NotificationProvider></AuthProvider>; }
export default App;
