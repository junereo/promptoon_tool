import axios, { AxiosHeaders } from 'axios';

import { clearCookieSessionHint, hasCookieSessionHint } from '../../features/auth/lib/auth-storage';
import { handleUnauthorizedResponse } from '../../features/auth/lib/auth-session';
import { useAuthStore } from '../../features/auth/store/use-auth-store';
import type { AuthResponse } from '@promptoon/shared';

export const API_ROOT_URL = import.meta.env.VITE_PROMPTOON_API_ROOT_URL || '/api';
export const API_BASE_URL = import.meta.env.VITE_PROMPTOON_API_BASE_URL || `${API_ROOT_URL}/promptoon`;

export class ApiError extends Error {
  public readonly status: number;
  public readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let refreshSessionPromise: Promise<AuthResponse> | null = null;

function refreshCookieSession(): Promise<AuthResponse> {
  if (!refreshSessionPromise) {
    refreshSessionPromise = axios
      .post<AuthResponse>(
        `${API_ROOT_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      .then((response) => {
        useAuthStore.getState().login(response.data);
        return response.data;
      })
      .catch((error) => {
        clearCookieSessionHint();
        throw error;
      })
      .finally(() => {
        refreshSessionPromise = null;
      });
  }

  return refreshSessionPromise;
}

function createApiClient(options: { redirectOnUnauthorized: boolean }) {
  const client = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  client.interceptors.request.use((config) => {
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers instanceof AxiosHeaders) {
        config.headers.delete('Content-Type');
      } else if (config.headers && typeof config.headers === 'object') {
        delete (config.headers as Record<string, unknown>)['Content-Type'];
      }
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const status = error.response?.status ?? 500;
      const message = error.response?.data?.error ?? error.message ?? 'Request failed.';
      const details = error.response?.data?.details;
      const originalRequest = error.config;

      if (options.redirectOnUnauthorized && status === 401 && originalRequest && !originalRequest.__promptoonRetry) {
        originalRequest.__promptoonRetry = true;
        if (!useAuthStore.getState().isAuthenticated && !hasCookieSessionHint()) {
          handleUnauthorizedResponse();
          return Promise.reject(new ApiError(message, status, details));
        }

        try {
          await refreshCookieSession();
          return client.request(originalRequest);
        } catch {
          handleUnauthorizedResponse();
        }
      } else if (options.redirectOnUnauthorized && status === 401) {
        handleUnauthorizedResponse();
      }

      return Promise.reject(new ApiError(message, status, details));
    }
  );

  return client;
}

export const apiClient = createApiClient({
  redirectOnUnauthorized: true
});

export const publicApiClient = createApiClient({
  redirectOnUnauthorized: false
});

function createRootApiClient(options: { redirectOnUnauthorized: boolean }) {
  const client = createApiClient(options);
  client.defaults.baseURL = API_ROOT_URL;
  return client;
}

export const rootApiClient = createRootApiClient({
  redirectOnUnauthorized: true
});

export const publicRootApiClient = createRootApiClient({
  redirectOnUnauthorized: false
});
