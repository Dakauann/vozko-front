/**
 * Browser-side cookie helpers for non-httpOnly preference cookies (active
 * workspace / department, referral code). These replace the server-side
 * `next/headers` cookie writes so the code can run in client components.
 *
 * Auth cookies (accessToken/refreshToken) are httpOnly and set by the API, they
 * are NOT managed here.
 */

function crossSubdomainSuffix(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost");
  const isIPv4 = /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  if (isLocalhost || isIPv4) return null;
  const parts = hostname.split(".");
  if (parts.length < 2) return null;
  return `; domain=.${parts.slice(-2).join(".")}`;
}

export function readClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function setClientCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
): void {
  if (typeof document === "undefined") return;
  const base = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
  document.cookie = base;
  const domain = crossSubdomainSuffix();
  if (domain) document.cookie = base + domain;
}

export function clearClientCookie(name: string): void {
  if (typeof document === "undefined") return;
  const base = `${name}=; path=/; max-age=0; samesite=lax`;
  document.cookie = base;
  const domain = crossSubdomainSuffix();
  if (domain) document.cookie = base + domain;
}
