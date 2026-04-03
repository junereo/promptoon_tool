import axios, { AxiosHeaders } from 'axios';

import { handleUnauthorizedResponse } from '../../features/auth/lib/auth-session';
import { useAuthStore } from '../../features/auth/store/use-auth-store';

export const API_BASE_URL = import.meta.env.VITE_PROMPTOON_API_BASE_URL || '/api/promptoon';

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

function createApiClient(options: { attachAuthToken: boolean; redirectOnUnauthorized: boolean }) {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  client.interceptors.request.use((config) => {
    if (options.attachAuthToken) {
      const token = useAuthStore.getState().token;
      if (token) {
        const headers = AxiosHeaders.from(config.headers ?? {});
        headers.set('Authorization', `Bearer ${token}`);
        config.headers = headers;
      }
    }

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
    (error) => {
      const status = error.response?.status ?? 500;
      const message = error.response?.data?.error ?? error.message ?? 'Request failed.';
      const details = error.response?.data?.details;

      if (options.redirectOnUnauthorized && status === 401) {
        handleUnauthorizedResponse();
      }

      return Promise.reject(new ApiError(message, status, details));
    }
  );

  return client;
}

export const apiClient = createApiClient({
  attachAuthToken: true,
  redirectOnUnauthorized: true
});

export const publicApiClient = createApiClient({
  attachAuthToken: false,
  redirectOnUnauthorized: false
});
