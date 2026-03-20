"use client";

import { Capacitor } from "@capacitor/core";
import { ApiService } from "@/lib/services/api-service";
import { getLocalItem, setLocalItem } from "@/lib/utils/session-storage";

export type TickerUniverseRow = {
  ticker: string;
  title?: string | null;
  cik?: string | number | null;
  exchange?: string | null;
  sic_code?: string | null;
  sic_description?: string | null;
  sector_primary?: string | null;
  industry_primary?: string | null;
  sector?: string | null;
  industry?: string | null;
  sector_tags?: string[] | null;
  metadata_confidence?: number | null;
  tradable?: boolean | null;
};

type CachePayload = {
  v: number;
  fetchedAt: number;
  rows: TickerUniverseRow[];
};

const STORAGE_KEY = "cache:kai:ticker-universe:v2";
const CACHE_VERSION = 2;
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

let inMemory: CachePayload | null = null;
let inFlight: Promise<TickerUniverseRow[]> | null = null;
const remoteSearchInFlight = new Map<string, Promise<TickerUniverseRow[]>>();

function normalizeRow(row: TickerUniverseRow): TickerUniverseRow {
  return {
    ticker: String(row.ticker || "").toUpperCase(),
    title: row.title ?? null,
    cik: row.cik ?? null,
    exchange: row.exchange ?? null,
    sic_code: row.sic_code ?? null,
    sic_description: row.sic_description ?? null,
    sector_primary: row.sector_primary ?? row.sector ?? null,
    industry_primary: row.industry_primary ?? row.industry ?? null,
    sector: row.sector ?? row.sector_primary ?? null,
    industry: row.industry ?? row.industry_primary ?? null,
    sector_tags: Array.isArray(row.sector_tags)
      ? row.sector_tags
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [],
    metadata_confidence:
      typeof row.metadata_confidence === "number" && Number.isFinite(row.metadata_confidence)
        ? row.metadata_confidence
        : null,
    tradable:
      typeof row.tradable === "boolean"
        ? row.tradable
        : row.tradable === null
          ? null
          : true,
  };
}

function safeParse(json: string): CachePayload | null {
  try {
    const parsed = JSON.parse(json) as CachePayload;
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.v !== CACHE_VERSION) return null;
    if (!Array.isArray(parsed.rows)) return null;
    if (typeof parsed.fetchedAt !== "number") return null;
    return {
      v: CACHE_VERSION,
      fetchedAt: parsed.fetchedAt,
      rows: parsed.rows.map(normalizeRow),
    };
  } catch {
    return null;
  }
}

function readFromStorage(): CachePayload | null {
  if (typeof window === "undefined") return null;
  const raw = getLocalItem(STORAGE_KEY);
  if (!raw) return null;
  return safeParse(raw);
}

function writeToStorage(payload: CachePayload) {
  if (typeof window === "undefined") return;
  try {
    setLocalItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

function isFresh(payload: CachePayload, ttlMs: number): boolean {
  return Date.now() - payload.fetchedAt < ttlMs;
}

async function fetchUniverse(forceRefresh = false): Promise<TickerUniverseRow[]> {
  const endpoint = forceRefresh ? "/api/tickers/all?refresh=1" : "/api/tickers/all";
  const parseRows = async (
    resp: Response,
    source: "primary"
  ): Promise<TickerUniverseRow[]> => {
    if (!resp.ok) {
      throw new Error(
        `Ticker universe request failed via ${source} (${endpoint}) with status ${resp.status}`
      );
    }
    const json = (await resp.json()) as unknown;
    if (!Array.isArray(json)) return [];
    return (json as TickerUniverseRow[]).map(normalizeRow);
  };

  try {
    const resp = await ApiService.apiFetch(endpoint, { method: "GET" });
    return await parseRows(resp, "primary");
  } catch (error) {
    const primaryMessage =
      error instanceof Error ? error.message : "Unknown ticker universe error";
    if (Capacitor.isNativePlatform()) {
      throw new Error(primaryMessage);
    }
    throw new Error(`${primaryMessage}. Request failed for ${endpoint}.`);
  }
}

/**
 * Preload the full ticker universe once.
 * - Uses in-memory cache first
 * - Falls back to localStorage
 * - Otherwise fetches /api/tickers/all and persists
 */
export async function preloadTickerUniverse(options?: {
  ttlMs?: number;
  forceRefresh?: boolean;
}): Promise<TickerUniverseRow[]> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh && inMemory && isFresh(inMemory, ttlMs)) {
    return inMemory.rows;
  }

  if (!forceRefresh) {
    const stored = readFromStorage();
    if (stored && isFresh(stored, ttlMs)) {
      inMemory = stored;
      return stored.rows;
    }
  }

  if (!inFlight) {
    inFlight = (async () => {
      const rows = await fetchUniverse(forceRefresh);
      const payload: CachePayload = {
        v: CACHE_VERSION,
        fetchedAt: Date.now(),
        rows,
      };
      inMemory = payload;
      writeToStorage(payload);
      return rows;
    })().finally(() => {
      inFlight = null;
    });
  }

  return inFlight;
}

export function getTickerUniverseSync(): TickerUniverseRow[] | null {
  return inMemory?.rows ?? null;
}

/**
 * Return a synchronous ticker snapshot from memory or localStorage.
 * Useful for immediate UX while async preload runs.
 */
export function getTickerUniverseSnapshot(): TickerUniverseRow[] | null {
  if (inMemory?.rows?.length) {
    return inMemory.rows;
  }
  const stored = readFromStorage();
  if (stored?.rows?.length) {
    inMemory = stored;
    return stored.rows;
  }
  return null;
}

/**
 * Search the backend ticker cache (Python in-memory cache) for continuous results.
 * This complements the local universe preload and keeps suggestions responsive.
 */
export async function searchTickerUniverseRemote(
  query: string,
  limit = 25,
): Promise<TickerUniverseRow[]> {
  const q = query.trim();
  if (!q) return [];
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const key = `${q.toUpperCase()}::${safeLimit}`;
  const cachedPromise = remoteSearchInFlight.get(key);
  if (cachedPromise) return cachedPromise;

  const promise = (async () => {
    const endpoint = `/api/tickers/search?q=${encodeURIComponent(q)}&limit=${safeLimit}`;
    const parseRows = async (
      resp: Response,
      source: "primary"
    ): Promise<TickerUniverseRow[]> => {
      if (!resp.ok) {
        throw new Error(
          `Ticker search failed via ${source} (${endpoint}) with status ${resp.status}`
        );
      }
      const json = (await resp.json()) as unknown;
      if (!Array.isArray(json)) return [];
      return (json as TickerUniverseRow[]).map(normalizeRow);
    };

    try {
      const resp = await ApiService.apiFetch(endpoint, { method: "GET" });
      return await parseRows(resp, "primary");
    } catch (error) {
      const primaryMessage =
        error instanceof Error ? error.message : "Unknown ticker search error";
      if (Capacitor.isNativePlatform()) {
        throw new Error(primaryMessage);
      }
      throw new Error(`${primaryMessage}. Request failed for ${endpoint}.`);
    }
  })().finally(() => {
    remoteSearchInFlight.delete(key);
  });

  remoteSearchInFlight.set(key, promise);
  return promise;
}

export function searchTickerUniverse(
  rows: TickerUniverseRow[],
  query: string,
  limit: number
): TickerUniverseRow[] {
  const q = (query || "").trim().toLowerCase();
  if (!q) return rows.slice(0, limit);

  // Fast path: prefix match on ticker
  const qUpper = q.toUpperCase();
  const prefixMatches: TickerUniverseRow[] = [];
  const containsMatches: TickerUniverseRow[] = [];

  for (const r of rows) {
    const t = r.ticker;
    const title = (r.title ?? "").toString();

    if (t.startsWith(qUpper)) {
      prefixMatches.push(r);
    } else if (
      t.toLowerCase().includes(q) ||
      title.toLowerCase().includes(q)
    ) {
      containsMatches.push(r);
    }

    if (prefixMatches.length >= limit) break;
  }

  if (prefixMatches.length >= limit) return prefixMatches.slice(0, limit);

  const remaining = limit - prefixMatches.length;
  return prefixMatches.concat(containsMatches.slice(0, remaining));
}
