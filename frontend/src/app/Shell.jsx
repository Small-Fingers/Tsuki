import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { useNotifications } from './notifications.jsx';
import { usePropertyTools } from './property-tools.jsx';
import { usePrefersReducedMotion } from './motion.js';

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Tsuki home">
      <svg className="brand-symbol" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.463.402.807a6.5 6.5 0 0 0 8.268 8.268c.344-.215.829-.003.803.397z"
        />
      </svg>
      <span>TSUKI</span>
    </Link>
  );
}
function Header() {
  const auth = useAuth();
  const { savedIds, comparisonIds } = usePropertyTools();
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const sellPath = auth?.user?.role === 'seller' ? '/new-listing' : '/register';
  const closeMenu = () => setOpen(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);
  return (
    <header className="topbar">
      <Brand />
      <button
        className="menu-toggle"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-controls="main-navigation"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? '✕' : '☰'}
      </button>
      <nav id="main-navigation" className={open ? 'nav-open' : ''} aria-label="Main navigation">
        <NavLink
          onClick={closeMenu}
          to="/properties"
          className={({ isActive }) => (isActive ? 'nav-active' : '')}
        >
          Explore
        </NavLink>
        {auth?.user?.role === 'buyer' && (
          <NavLink
            onClick={closeMenu}
            to="/saved"
            className={({ isActive }) => (isActive ? 'nav-active' : '')}
          >
            Saved homes{savedIds.length > 0 && <span className="nav-count">{savedIds.length}</span>}
          </NavLink>
        )}
        {auth?.user?.role === 'buyer' && (
          <NavLink
            onClick={closeMenu}
            to="/alerts"
            className={({ isActive }) => (isActive ? 'nav-active' : '')}
          >
            Search alerts
          </NavLink>
        )}
        {auth?.user && auth.user.role !== 'admin' && (
          <NavLink
            onClick={closeMenu}
            to="/viewings"
            className={({ isActive }) => (isActive ? 'nav-active' : '')}
          >
            Viewings
          </NavLink>
        )}
        {comparisonIds.length > 0 && (
          <NavLink
            onClick={closeMenu}
            to="/compare"
            className={({ isActive }) => (isActive ? 'nav-active' : '')}
          >
            Compare<span className="nav-count">{comparisonIds.length}</span>
          </NavLink>
        )}
        {['buyer', 'seller'].includes(auth?.user?.role) && (
          <NavLink
            onClick={closeMenu}
            to="/notifications"
            className={({ isActive }) => (isActive ? 'nav-active' : '')}
          >
            Notifications
            {unreadCount > 0 && (
              <span className="nav-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </NavLink>
        )}
        {auth?.user?.role === 'seller' && (
          <NavLink
            onClick={closeMenu}
            to="/dashboard"
            className={({ isActive }) => (isActive ? 'nav-active' : '')}
          >
            Seller studio
          </NavLink>
        )}
        {auth?.user?.role === 'seller' && (
          <NavLink
            onClick={closeMenu}
            to="/leads"
            className={({ isActive }) => (isActive ? 'nav-active' : '')}
          >
            Leads
          </NavLink>
        )}
        {auth?.user?.role === 'admin' && (
          <NavLink
            onClick={closeMenu}
            to="/admin"
            className={({ isActive }) => (isActive ? 'nav-active' : '')}
          >
            Admin
          </NavLink>
        )}
        {['buyer', 'seller'].includes(auth?.user?.role) && (
          <NavLink
            onClick={closeMenu}
            to="/messages"
            className={({ isActive }) => (isActive ? 'nav-active' : '')}
          >
            Messages
          </NavLink>
        )}
        {auth?.user?.role !== 'admin' && (
          <NavLink
            onClick={closeMenu}
            to="/contact"
            className={({ isActive }) => (isActive ? 'nav-active' : '')}
          >
            Contact
          </NavLink>
        )}
        {(!auth?.user || auth.user.role === 'seller') && (
          <NavLink onClick={closeMenu} to={sellPath} className="nav-sell">
            List a property <span aria-hidden="true">↗</span>
          </NavLink>
        )}
      </nav>
      <div className="nav-actions">
        {auth?.user ? (
          <>
            <Link className="welcome profile-link" to="/profile">
              {auth.user.name.split(' ')[0]}
            </Link>
            <button className="button button-quiet" onClick={auth.logout}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="login-link">
              Sign in
            </Link>
            <Link to="/register" className="button button-small">
              Create account
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
export function Layout({ children }) {
  const auth = useAuth();
  const sellPath = auth?.user?.role === 'seller' ? '/new-listing' : '/register';
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" tabIndex="-1">
        {children}
      </main>
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <Brand />
            <p>
              A considered way to discover
              <br />
              the place you’ll call home.
            </p>
          </div>
          <div className="footer-column">
            <span>Discover</span>
            <Link to="/properties">All properties</Link>
            <Link to="/properties?purpose=sale">Homes to buy</Link>
            <Link to="/properties?purpose=rent">Homes to rent</Link>
          </div>
          <div className="footer-column">
            <span>Tsuki</span>
            {auth?.user?.role !== 'admin' && <Link to="/contact">Contact</Link>}
            {auth?.user ? (
              <Link to="/profile">Your profile</Link>
            ) : (
              <Link to="/login">Sign in</Link>
            )}
            {(!auth?.user || auth.user.role === 'seller') && (
              <Link to={sellPath}>List a property</Link>
            )}
          </div>
          <div className="footer-note">
            <span className="eyebrow">A quieter way to find home</span>
            <p>
              Thoughtful spaces.
              <br />
              Clear details. Direct conversations.
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span className="footer-copyright">
            © {new Date().getFullYear()} Tsuki <MoonEgg />
          </span>
          <span>Made for finding what feels right.</span>
          <span className="photo-attribution">
            Hero photo:{' '}
            <a
              href="https://commons.wikimedia.org/wiki/File:Modern_living_room_with_stylish_furniture_and_a_view_of_the_outdoors_in_a_cozy_apartment_setting.jpg"
              target="_blank"
              rel="noreferrer"
            >
              Shixart1985
            </a>{' '}
            ·{' '}
            <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noreferrer">
              CC BY 2.0
            </a>{' '}
            · cropped and toned
          </span>
          {auth?.user?.role !== 'admin' && <Link to="/contact">Get in touch ↗</Link>}
        </div>
      </footer>
      <Moonlight />
    </>
  );
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
  return (
    <div className="moonlight-stage" ref={stageRef} aria-hidden="true">
      <div className="moonlight-glow" ref={glowRef} />
    </div>
  );
}
function MoonEgg() {
  const [open, setOpen] = useState(false);
  return (
    <span className="moon-egg">
      <button
        type="button"
        className="moon-egg-trigger"
        aria-label="Reveal the moon phases"
        aria-expanded={open}
        title="A small lunar secret"
        onClick={() => setOpen((value) => !value)}
      >
        ☾
      </button>
      {open && (
        <span className="moon-egg-note" role="status">
          <span className="moon-egg-phases" aria-hidden="true">
            <i className="phase-new" />
            <i className="phase-crescent" />
            <i className="phase-half" />
            <i className="phase-full" />
          </span>
          <span>Every phase belongs.</span>
        </span>
      )}
    </span>
  );
}
