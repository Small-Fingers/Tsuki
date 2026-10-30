import { createContext, useContext, useState } from 'react';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('realstate-session')) || null;
    } catch {
      return null;
    }
  });
  const setAuth = (data) => {
    localStorage.setItem('realstate-session', JSON.stringify(data));
    setSession(data);
  };
  const logout = () => {
    localStorage.removeItem('realstate-session');
    setSession(null);
  };
  return (
    <AuthContext.Provider value={{ ...session, setAuth, logout }}>{children}</AuthContext.Provider>
  );
}
