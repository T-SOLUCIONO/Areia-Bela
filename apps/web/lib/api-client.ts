import { REFRESH_TOKEN_COOKIE } from '@areia-bela/shared'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = response.statusText
  try {
    const body = (await response.json()) as { message?: string | string[] }
    if (Array.isArray(body.message)) message = body.message.join(', ')
    else if (body.message) message = body.message
  } catch {
    // Non-JSON error body; the status text is the best we have.
  }
  return new ApiError(response.status, message)
}

/**
 * Browser-side API client. Always sends cookies, and on a 401 tries a single
 * silent refresh before giving up — so a 15-minute access token expiring
 * mid-session doesn't kick the user out.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const request = (): Promise<Response> =>
    fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })

  let response = await request()

  if (response.status === 401 && path !== '/auth/refresh') {
    const refreshed = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    // Only one attempt: if the refresh itself fails the session is genuinely
    // over, and retrying would loop.
    if (refreshed.ok) response = await request()
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}

export { API_URL, REFRESH_TOKEN_COOKIE }
