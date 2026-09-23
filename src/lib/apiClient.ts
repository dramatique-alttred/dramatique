import { firebaseAuth } from './firebase'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'

export class ApiError extends Error {
  // `code` is the backend's machine-readable reason (e.g. INSUFFICIENT_COINS)
  constructor(public status: number, message: string, public code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const token = await firebaseAuth?.currentUser?.getIdToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(await authHeader()),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.error || `Request failed: ${res.status} ${res.statusText}`, body.code)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
