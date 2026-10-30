import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

export const PropertyToolsContext = createContext(null);
export const usePropertyTools = () => useContext(PropertyToolsContext);
export function PropertyToolsProvider({ children }) {
  const auth = useAuth();
  const [savedIds, setSavedIds] = useState([]);
  // Keep comparisons available before sign-in and after reload, with the same four-home limit as the UI.
  const [comparisonIds, setComparisonIds] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('tsuki-comparison') || '[]');
      return Array.isArray(stored) ? stored.slice(0, 4) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (auth?.user?.role !== 'buyer') {
      setSavedIds([]);
      return undefined;
    }
    let active = true;
    api
      .get('/api/favorites')
      .then(({ data }) => {
        if (active) setSavedIds(data.properties.map((property) => String(property._id)));
      })
      .catch(() => {
        if (active) setSavedIds([]);
      });
    return () => {
      active = false;
    };
  }, [auth?.user?._id, auth?.user?.role]);
  useEffect(() => {
    localStorage.setItem('tsuki-comparison', JSON.stringify(comparisonIds));
  }, [comparisonIds]);
  const toggleSaved = async (propertyId) => {
    if (auth?.user?.role !== 'buyer') return { success: false, loginRequired: true };
    const id = String(propertyId);
    const wasSaved = savedIds.includes(id);
    try {
      if (wasSaved) await api.delete(`/api/favorites/${id}`);
      else await api.put(`/api/favorites/${id}`);
      setSavedIds((current) =>
        wasSaved ? current.filter((savedId) => savedId !== id) : [...new Set([...current, id])],
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Could not update saved homes.',
      };
    }
  };
  const toggleComparison = (propertyId) => {
    const id = String(propertyId);
    if (comparisonIds.includes(id)) {
      setComparisonIds((current) => current.filter((item) => item !== id));
      return { success: true, added: false };
    }
    if (comparisonIds.length >= 4)
      return { success: false, message: 'Compare up to four homes at a time.' };
    setComparisonIds((current) => [...current, id]);
    return { success: true, added: true };
  };
  return (
    <PropertyToolsContext.Provider
      value={{ savedIds, comparisonIds, toggleSaved, toggleComparison, setComparisonIds }}
    >
      {children}
    </PropertyToolsContext.Provider>
  );
}
