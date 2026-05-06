import axios, { AxiosHeaders } from 'axios';

import { handleUnauthorizedResponse } from '../../features/auth/auth-session';
import { useAdminAuthStore } from '../../features/auth/use-admin-auth-store';

export const API_ROOT_URL = import.meta.env.VITE_PROMPTOON_API_ROOT_URL || '/api';

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

function createRootApiClient(options: { attachAuthToken: boolean; redirectOnUnauthorized: boolean }) {
  const client = axios.create({
    baseURL: API_ROOT_URL,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  client.interceptors.request.use((config) => {
    if (options.attachAuthToken) {
      const token = useAdminAuthStore.getState().token;
      if (token) {
        const headers = AxiosHeaders.from(config.headers ?? {});
        headers.set('Authorization', `Bearer ${token}`);
        config.headers = headers;
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

export const rootApiClient = createRootApiClient({
  attachAuthToken: true,
  redirectOnUnauthorized: true
});

export const publicRootApiClient = createRootApiClient({
  attachAuthToken: false,
  redirectOnUnauthorized: false
});
