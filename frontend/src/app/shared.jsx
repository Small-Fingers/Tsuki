import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

export const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const PROPERTY_COLLECTIONS = [
  { type: 'apartment,flat,studio,penthouse', title: 'Apartments', subtitle: 'Apartments, flats, studios and penthouses', matches: ['apartment', 'flat', 'studio', 'penthouse'] },
  { type: 'villa,house,townhouse', title: 'Villas & houses', subtitle: 'Villas, houses and townhouses', matches: ['villa', 'house', 'townhouse'] },
  { type: 'commercial,office', title: 'Commercial spaces', subtitle: 'Offices and commercial listings', matches: ['commercial', 'office'] },
];
export const AuthContext = createContext(null);
export const PropertyToolsContext = createContext(null);
export const NotificationContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export const usePropertyTools = () => useContext(PropertyToolsContext);
export const useNotifications = () => useContext(NotificationContext);
export function usePrefersReducedMotion() {
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
export const api = axios.create({ baseURL: API });
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
export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => { try { return JSON.parse(localStorage.getItem('realstate-session')) || null; } catch { return null; } });
  const setAuth = (data) => { localStorage.setItem('realstate-session', JSON.stringify(data)); setSession(data); };
  const logout = () => { localStorage.removeItem('realstate-session'); setSession(null); };
  return <AuthContext.Provider value={{ ...session, setAuth, logout }}>{children}</AuthContext.Provider>;
}
export function NotificationProvider({ children }) {
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
export function PropertyToolsProvider({ children }) {
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
export const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
export const localDateKey = (value) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
export const availabilityInfo = (property) => {
  if (property.status && property.status !== 'sale') return { stale: false, label: '' };
  const confirmedAt = property.availabilityConfirmedAt || property.updatedAt || property.createdAt;
  if (!confirmedAt) return { stale: true, label: 'Availability unconfirmed' };
  const days = Math.max(0, Math.floor((Date.now() - new Date(confirmedAt).getTime()) / 86_400_000));
  const stale = property.availabilityNeedsConfirmation ?? days > 30;
  return { stale, label: stale ? 'Availability unconfirmed' : days === 0 ? 'Confirmed today' : days === 1 ? 'Confirmed yesterday' : `Confirmed ${days} days ago` };
};
export async function watchChatUpdates(onUpdate, signal) {
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

export const availabilityLabel = (property) => property.status === 'unavailable' ? 'Unavailable' : property.status === 'sold' ? 'Sold' : property.status === 'rented' ? 'Rented' : property.purpose === 'rent' ? 'For rent' : 'For sale';
