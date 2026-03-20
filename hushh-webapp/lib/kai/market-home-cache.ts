import type { KaiHomeInsightsV2 } from "@/lib/services/api-service";
import type { CacheSnapshot } from "@/lib/services/cache-service";
import { getSessionItem, setSessionItem } from "@/lib/utils/session-storage";

export type KaiHomeCacheCandidate = {
  payload: KaiHomeInsightsV2;
  isFresh: boolean;
  savedAt: number;
  source: "memory" | "memory-fallback" | "session" | "persistent";
};

export function getKaiMarketHomeSessionCacheKey(userId: string, pickSource: string): string {
  return `kai_market_home_session_${userId}_${pickSource}`;
}

export function getKaiMarketHomePersistentCacheKey(userId: string, pickSource: string): string {
  return `kai_market_home_last_known_${userId}_${pickSource}`;
}

export function toKaiHomeCacheCandidate(
  snapshot: CacheSnapshot<KaiHomeInsightsV2> | null,
  source: KaiHomeCacheCandidate["source"]
): KaiHomeCacheCandidate | null {
  if (!snapshot) return null;
  return {
    payload: snapshot.data,
    isFresh: snapshot.isFresh,
    savedAt: snapshot.timestamp,
    source,
  };
}

export function parseStoredKaiHomeCache(
  raw: string | null,
  ttlMs: number,
  source: Exclude<KaiHomeCacheCandidate["source"], "memory" | "memory-fallback">
): KaiHomeCacheCandidate | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      payload?: KaiHomeInsightsV2;
      savedAt?: number;
    };
    if (!parsed?.payload) return null;
    const savedAt = Number(parsed.savedAt || 0);
    if (!Number.isFinite(savedAt) || savedAt <= 0) return null;
    const ageMs = Date.now() - savedAt;
    if (ageMs < 0) return null;
    return {
      payload: parsed.payload,
      isFresh: ageMs <= ttlMs,
      savedAt,
      source,
    };
  } catch {
    return null;
  }
}

export function readStoredKaiHomeCache(params: {
  userId: string;
  pickSource: string;
  sessionTtlMs: number;
  persistentTtlMs: number;
}): KaiHomeCacheCandidate | null {
  return (
    parseStoredKaiHomeCache(
      getSessionItem(getKaiMarketHomeSessionCacheKey(params.userId, params.pickSource)),
      params.sessionTtlMs,
      "session"
    ) ||
    parseStoredKaiHomeCache(
      getSessionItem(getKaiMarketHomePersistentCacheKey(params.userId, params.pickSource)),
      params.persistentTtlMs,
      "persistent"
    )
  );
}

export function persistKaiMarketHomePayload(params: {
  userId: string;
  pickSource: string;
  payload: KaiHomeInsightsV2;
  savedAt?: number;
}): void {
  const savedAt = params.savedAt ?? Date.now();
  const envelope = JSON.stringify({ payload: params.payload, savedAt });
  setSessionItem(getKaiMarketHomeSessionCacheKey(params.userId, params.pickSource), envelope);
  setSessionItem(getKaiMarketHomePersistentCacheKey(params.userId, params.pickSource), envelope);
}
