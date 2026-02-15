"use client";

import { ApiService } from "@/lib/services/api-service";

export type TickerUniverseRow = {
  ticker: string;
  title?: string | null;
  cik?: string | number | null;
  exchange?: string | null;
};

type CachePayload = {
  v: number;
  fetchedAt: number;
  rows: TickerUniverseRow[];
};

const STORAGE_KEY = "cache:kai:ticker-universe:v1";
const CACHE_VERSION = 1;
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
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return safeParse(raw);
}

function writeToStorage(payload: CachePayload) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

function isFresh(payload: CachePayload, ttlMs: number): boolean {
  return Date.now() - payload.fetchedAt < ttlMs;
}

async function fetchUniverse(): Promise<TickerUniverseRow[]> {
  const resp = await ApiService.apiFetch("/api/tickers/all", { method: "GET" });
  if (!resp.ok) throw new Error("Failed to fetch ticker universe");
  const json = (await resp.json()) as unknown;
  if (!Array.isArray(json)) return [];
  return (json as TickerUniverseRow[]).map(normalizeRow);
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
      const rows = await fetchUniverse();
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
    const resp = await ApiService.apiFetch(endpoint, { method: "GET" });
    if (!resp.ok) throw new Error("Failed to search ticker universe");
    const json = (await resp.json()) as unknown;
    if (!Array.isArray(json)) return [];
    return (json as TickerUniverseRow[]).map(normalizeRow);
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
