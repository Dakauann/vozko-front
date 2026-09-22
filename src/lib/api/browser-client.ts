"use client";


const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  "http://localhost:3001";

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export interface ApiResult<T> {
  data?: T;
  error?: { message: string; status?: number; code?: string };
}

const AUTH_TIMEOUT_MS = 10_000;

const UPLOAD_TIMEOUT_MS = 10 * 60_000;

const ANALYTICS_TIMEOUT_MS = 30_000;

function isAnalyticsEndpoint(endpoint: string): boolean {
  return endpoint.startsWith("/attendance/");
}

function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const id = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    ms,
  );
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

function assertBrowser(fn: string): void {
  if (typeof window !== "undefined") return;
  const message = `[browser-client] ${fn}() was called on the server. Auth is browser-only; call it from an effect/handler, never during render/SSR.`;
  if (process.env.NODE_ENV !== "production") {
    throw new Error(message);
  }
  console.error(message);
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function scopeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const workspaceId = readCookie("workspaceId");
  if (workspaceId) headers["X-Workspace-ID"] = workspaceId;
  const departmentId = readCookie("departmentId");
  if (departmentId) headers["X-Department-ID"] = departmentId;
  return headers;
}


const AUTH_CHANNEL = "vozko-auth";
const SESSION_EXPIRED = "vozko:session-expired";

let channel: BroadcastChannel | null = null;
function authChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  if (!channel) channel = new BroadcastChannel(AUTH_CHANNEL);
  return channel;
}

let expiredEmitted = false;

export function notifySessionExpired(): void {
  if (expiredEmitted) return;
  expiredEmitted = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }
  authChannel()?.postMessage(SESSION_EXPIRED);
}

export function onSessionExpired(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const local = () => handler();
  window.addEventListener(SESSION_EXPIRED, local);
  const ch = authChannel();
  const onMessage = (event: MessageEvent) => {
    if (event.data === SESSION_EXPIRED) handler();
  };
  ch?.addEventListener("message", onMessage);
  return () => {
    window.removeEventListener(SESSION_EXPIRED, local);
    ch?.removeEventListener("message", onMessage);
  };
}


let refreshInFlight: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  const t = timeoutSignal(AUTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Auth-Mode": "cookie" },
      body: "{}",
      signal: t.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    t.clear();
  }
}

export function refreshSession(): Promise<boolean> {
  assertBrowser("refreshSession");
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
      if (locks?.request) {
        const acq = timeoutSignal(AUTH_TIMEOUT_MS);
        try {
          return await locks.request(
            "vozko-auth-refresh",
            { signal: acq.signal },
            performRefresh,
          );
        } catch (err) {
          if (
            err instanceof DOMException &&
            (err.name === "TimeoutError" || err.name === "AbortError")
          ) {
            return await performRefresh();
          }
          throw err;
        } finally {
          acq.clear();
        }
      }
      return await performRefresh();
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function fetchWithRefresh(
  makeRequest: () => Promise<Response>,
): Promise<Response> {
  let response = await makeRequest();
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await makeRequest();
    } else {
      notifySessionExpired();
    }
  }
  return response;
}


export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  assertBrowser("apiClient");
  const isAbsolute = /^https?:\/\//i.test(endpoint);
  const url = isAbsolute ? endpoint : `${API_BASE_URL}${endpoint}`;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const run = () => {
    const t = timeoutSignal(
      isFormData
        ? UPLOAD_TIMEOUT_MS
        : isAnalyticsEndpoint(endpoint)
          ? ANALYTICS_TIMEOUT_MS
          : AUTH_TIMEOUT_MS,
    );
    return fetch(url, {
      ...options,
      credentials: "include",
      signal: options.signal ?? t.signal,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...scopeHeaders(),
        ...options.headers,
      },
    }).finally(() => t.clear());
  };

  try {
    const response = await fetchWithRefresh(run);

    if (!response.ok) {
      if (response.status === 401) {
        return {
          error: { message: "Session expired. Please login again.", status: 401 },
        };
      }
      const body = (await response
        .json()
        .catch(() => ({}))) as { message?: string; error?: string; code?: string };
      return {
        error: {
          message: body.message || body.error || `API error: ${response.statusText}`,
          status: response.status,
          code: body.code,
        },
      };
    }

    if (response.status === 204) return {};
    const data = (await response.json().catch(() => undefined)) as T | undefined;
    return { data };
  } catch (error) {
    return {
      error: {
        message: error instanceof Error ? error.message : "Network error",
      },
    };
  }
}
