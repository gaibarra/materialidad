import { loadSession } from "./token-storage";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!apiBaseUrl) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL debe estar definido");
}

export async function apiFetchRaw(path: string, init: RequestInit = {}): Promise<Response> {
  const session = loadSession();
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  if (session?.tenant) {
    headers.set("X-Tenant", session.tenant);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = `Error API ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data === "string") {
        message = data;
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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetchRaw(path, init);

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("application/json")) {
    return null as T;
  }

  return (await response.json()) as T;
}
