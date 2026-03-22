import { loadSession, persistSession, removeSession } from "./token-storage";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!apiBaseUrl) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL debe estar definido");
}

/* ── Timeout helper ── */
const FETCH_TIMEOUT_MS = 12_000; // 12 seconds

function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal })
    .catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`La solicitud excedió el tiempo límite de ${Math.round(timeoutMs / 1000)} segundos.`);
      }
      if (typeof error === "string" && error === "timeout") {
        throw new Error(`La solicitud excedió el tiempo límite de ${Math.round(timeoutMs / 1000)} segundos.`);
      }
      throw error;
    })
    .finally(() => clearTimeout(timer));
}

/* ── Token refresh logic ── */

let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to get a new access token using the stored refresh token.
 * De-duplicates concurrent calls so only one refresh request flies at a time.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const session = loadSession();
    if (!session?.refreshToken) return null;

    try {
      const res = await fetchWithTimeout(`${apiBaseUrl}/api/accounts/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: session.refreshToken }),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        access: string;
        refresh?: string;
      };

      // Persist the new tokens (refresh may rotate)
      persistSession({
        accessToken: data.access,
        refreshToken: data.refresh ?? session.refreshToken,
        tenant: session.tenant,
      });

      // Dispatch event so AuthContext picks up the new tokens
      window.dispatchEvent(new Event("session-refreshed"));

      return data.access;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/* ── Core fetch with auto-retry on 401 ── */

async function doFetch(path: string, init: RequestInit, token?: string, timeoutMs?: number): Promise<Response> {
  const session = loadSession();
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const effectiveToken = token ?? session?.accessToken;
  if (effectiveToken) {
    headers.set("Authorization", `Bearer ${effectiveToken}`);
  }
  if (session?.tenant) {
    headers.set("X-Tenant", session.tenant);
  }

  return fetchWithTimeout(`${apiBaseUrl}${path}`, { ...init, headers, cache: "no-store" }, timeoutMs);
}

export async function apiFetchRaw(path: string, init: RequestInit = {}, timeoutMs?: number): Promise<Response> {
  let response = await doFetch(path, init, undefined, timeoutMs);

  // On 401, try to refresh the token and retry once
  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await doFetch(path, init, newToken, timeoutMs);
    }
  }

  if (!response.ok) {
    let message = `Error API ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data === "string") {
        message = data;
      } else if (data?.field_errors && typeof data.field_errors === "object") {
        message = JSON.stringify(data);
      } else if (data?.detail) {
        message = data.detail as string;
      } else if (data && Object.keys(data).length > 0) {
        message = JSON.stringify(data);
      }
    } catch {
      try {
        const text = await response.text();
        if (text) {
          message = text;
        }
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }

  return response;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  const response = await apiFetchRaw(path, init, timeoutMs);

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    return null as T;
  }

  return (await response.json()) as T;
}
