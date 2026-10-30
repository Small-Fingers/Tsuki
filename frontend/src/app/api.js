import axios from 'axios';

export const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const api = axios.create({ baseURL: API });
// Read the session for each request so login and logout update auth without recreating the client.
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
