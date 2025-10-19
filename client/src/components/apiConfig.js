import axios from 'axios';
import { store } from '../store';
import { authActions } from '../store';

const isProd = process.env.NODE_ENV === 'production';

const api = axios.create({
  baseURL: isProd
    ? 'https://cadenza.com.hr'
    : 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Important for cookies
});

const pendingRequests = new Map();

const cacheWrapper = async (method, url, config = {}) => {
  if (method.toLowerCase() !== 'get') {
    return api[method](url, config);
  }

  const isManualRefresh = config.headers?.['Cache-Control'] === 'no-cache';
  const baseURL = api.defaults.baseURL || window.location.origin;
  const fullURL = url.startsWith('http') ? url : `${baseURL}${url}`;
  
  // SECURITY FIX: Include user token in cache key to prevent cross-user data leakage
  const token = localStorage.getItem('token');
  const userIdentifier = token ? token.substring(token.length - 20) : 'anonymous'; // Last 20 chars as identifier
  const queryString = config.params ? `?${new URLSearchParams(config.params)}` : '';
  const cacheKey = new Request(`${fullURL}${queryString}&_user=${userIdentifier}`);

  try {
    const cache = await caches.open('dynamic-v2');
    if (isManualRefresh) {
      await cache.delete(cacheKey);
    } else {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const data = await cachedResponse.json();
        return data;
      }
    }

    try {
      const response = await api[method](url, config);

      if (!isManualRefresh) {
        const responseToCache = new Response(JSON.stringify(response.data), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'max-age=300'
          }
        });
        await cache.put(cacheKey, responseToCache);
      }

      return response.data;
    } catch (networkError) {
      // If the request itself failed
      if (networkError?.isAxiosError) {
        // Swallow 404s as a valid "not found" result without retry
        if (networkError.response?.status === 404) {
          return null;
        }
        // Re-throw other HTTP errors without retrying to avoid double requests
        throw networkError;
      }
      // Non-Axios error (unlikely here) - rethrow
      throw networkError;
    }
  } catch (cacheError) {
    // Only cache layer failed: fall back to a single network request
    try {
      const response = await api[method](url, config);
      return response.data;
    } catch (networkError) {
      if (networkError?.isAxiosError && networkError.response?.status === 404) {
        return null;
      }
      throw networkError;
    }
  }
};

const cachedApi = {
  get: (url, config) => cacheWrapper('get', url, config),
  post: (url, data, config) => api.post(url, data, config),
  put: (url, data, config) => api.put(url, data, config),
  delete: (url, config) => api.delete(url, config)
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Only redirect to login on 401 if NOT on the login endpoint itself
    // (to prevent redirect loop and allow login errors to display)
    const isLoginEndpoint = error.config?.url?.includes('/api/login');
    
    if (error.response?.status === 401 && !isLoginEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('isLoggedIn');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
  }
};

const invalidateCache = async () => {
  const cache = await caches.open('dynamic-v2');
  const keys = await cache.keys();
  for (const key of keys) {
    await cache.delete(key);
  }
};

async function openRequestsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cadenza-requests', 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('requests')) {
        db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const saveRequestToDB = async (url, method, data) => {
  if (!navigator.onLine) {
    console.log('[API] Offline - Request saved:', { url, method, data });

    const db = await openRequestsDB();
    const tx = db.transaction('requests', 'readwrite');
    const store = tx.objectStore('requests');
    await store.add({ url, method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

    toast.info('Zahtjev spremljen. Bit će poslan kad se vratiš online.', {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "light",
      style: {
        background: 'var(--iznad)',
        color: 'var(--tekst)'
      }
    });

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-post-requests');
      console.log('[API] Sync request registered');
    }
  }
};


cachedApi.post = async (url, data, config) => {
  if (navigator.onLine) {
    return api.post(url, data, config);
  } else {
    await saveRequestToDB(url, 'POST', data);
    return { offline: true, message: 'Zahtjev spremljen. Bit će poslan kad se vratiš online.' };
  }
};

cachedApi.put = async (url, data, config) => {
  if (navigator.onLine) {
    return api.put(url, data, config);
  } else {
    await saveRequestToDB(url, 'PUT', data);
    return { offline: true, message: 'Zahtjev spremljen. Bit će poslan kad se vratiš online.' };
  }
};

cachedApi.delete = async (url, config) => {
  if (navigator.onLine) {
    return api.delete(url, config);
  } else {
    await saveRequestToDB(url, 'DELETE', { url, config });
    return { offline: true, message: 'Zahtjev spremljen. Bit će poslan kad se vratiš online.' };
  }
};

const ApiConfig = {
  api,
  cachedApi,
  baseUrl: isProd
    ? 'https://cadenza.com.hr'
    : 'http://localhost:5000',
  socketUrl: isProd
    ? 'https://cadenza.com.hr'
    : 'http://localhost:5000',
  setAuthToken,
  invalidateCache
};

export default ApiConfig;
