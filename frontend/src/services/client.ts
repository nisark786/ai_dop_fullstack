import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001/api';

export class ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Extracts a human-readable error message from FastAPI or network errors.
 * Handles both string details and Pydantic v2 validation error arrays.
 */
export function formatApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data) {
      if (typeof data === 'string') return data;
      if (typeof data.detail === 'string') return data.detail;
      if (Array.isArray(data.detail)) {
        return data.detail
          .map((err: { loc?: (string | number)[]; msg?: string }) => {
            const loc = err.loc ? err.loc.filter((part) => part !== 'body').join('.') : 'field';
            return `${loc}: ${err.msg || 'Invalid value'}`;
          })
          .join('; ');
      }
      if (typeof data.message === 'string') return data.message;
    }
    if (error.response?.status === 404) return 'Resource not found.';
    if (error.response?.status === 500) return 'Internal server error occurred.';
    return error.message || 'Request failed';
  }
  if (error instanceof Error) return error.message;
  return String(error || 'Unknown error');
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Accept': 'application/json',
  },
});

// Request interceptor: attach bearer tokens or custom telemetry
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: transform AxiosError into clean ApiError
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const message = formatApiError(error);
    const apiError = new ApiError(message, error.response?.status, error.code, error.response?.data);
    return Promise.reject(apiError);
  }
);

export default apiClient;
