import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';
import { watchChatUpdates } from './chat-updates.js';

export const NotificationContext = createContext(null);
export const useNotifications = () => useContext(NotificationContext);
export function NotificationProvider({ children }) {
  const auth = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!['buyer', 'seller'].includes(auth?.user?.role)) {
      setUnreadCount(0);
      return undefined;
    }
    let active = true;
    const controller = new AbortController();
    const refresh = () =>
      api
        .get('/api/notifications')
        .then(({ data }) => {
          if (active) setUnreadCount(data.unreadCount || 0);
        })
        .catch(() => {});
    refresh();
    watchChatUpdates(refresh, controller.signal);
    const interval = window.setInterval(refresh, 45_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [auth?.user?._id, auth?.user?.role]);
  const refreshNotifications = () =>
    api.get('/api/notifications').then(({ data }) => {
      setUnreadCount(data.unreadCount || 0);
      return data;
    });
  return (
    <NotificationContext.Provider value={{ unreadCount, refreshNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}
