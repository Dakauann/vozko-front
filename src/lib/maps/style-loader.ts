import type { StyleSpecification } from "maplibre-gl";

export class BaseStyleError extends Error {
  constructor(reason: string) {
    super(`base map style: ${reason}`);
    this.name = "BaseStyleError";
  }
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;

const cache = new Map<string, Promise<StyleSpecification>>();

function asStyle(body: unknown): StyleSpecification {
  const candidate = body as { version?: unknown; sources?: unknown; layers?: unknown } | null;
  if (!candidate || candidate.version !== 8) throw new BaseStyleError("not a version 8 style");
  if (!candidate.sources || typeof candidate.sources !== "object") throw new BaseStyleError("no sources");
  if (!Array.isArray(candidate.layers)) throw new BaseStyleError("no layers");
  return body as StyleSpecification;
}

async function fetchStyle(url: string, fetcher: Fetcher): Promise<StyleSpecification> {
  let response: Awaited<ReturnType<Fetcher>>;
  try {
    response = await fetcher(url, { credentials: "omit" });
  } catch {
    throw new BaseStyleError("unreachable");
  }
  if (!response.ok) throw new BaseStyleError(`answered ${response.status}`);
  return asStyle(await response.json());
}

export function loadBaseStyle(url: string, fetcher: Fetcher = fetch): Promise<StyleSpecification> {
  const cached = cache.get(url);
  if (cached) return cached;
  const pending = fetchStyle(url, fetcher);
  cache.set(url, pending);
  pending.catch(() => cache.delete(url));
  return pending;
}

export function forgetBaseStyles(): void {
  cache.clear();
}
