/**
 * Kai Analysis History Service
 *
 * Manages analysis history within the encrypted world model blob.
 * Uses FIFO strategy: max 3 analyses per ticker, newest first.
 *
 * Domain: "kai_analysis_history"
 *
 * Structure inside encrypted blob:
 * {
 *   "kai_analysis_history": {
 *     "AMZN": [entry3, entry2, entry1],  // newest first, max 3
 *     "AAPL": [entry2, entry1],
 *   }
 * }
 */

import { WorldModelService } from "./world-model-service";
import { CacheService, CACHE_KEYS } from "./cache-service";


const MAX_HISTORY_PER_TICKER = 3;
const DOMAIN = "kai_analysis_history";

// ============================================================================
// Types
// ============================================================================

export interface AnalysisHistoryEntry {
  ticker: string;
  timestamp: string; // ISO date
  decision: "buy" | "hold" | "reduce" | string;
  confidence: number;
  consensus_reached: boolean;
  agent_votes: Record<string, string>;
  final_statement: string;
  raw_card: Record<string, any>; // Full decision card data
  debate_transcript?: {
    round1: Record<string, any>;
    round2: Record<string, any>;
  };
}

export type AnalysisHistoryMap = Record<string, AnalysisHistoryEntry[]>;

function buildHistorySummary(
  historyMap: AnalysisHistoryMap,
  lastTicker?: string,
  lastTimestamp?: string
): Record<string, unknown> {
  const tickers = Object.keys(historyMap);
  const totalAnalyses = Object.values(historyMap).reduce((sum, arr) => sum + arr.length, 0);

  const summary: Record<string, unknown> = {
    domain_intent: "kai_analysis_history",
    total_analyses: totalAnalyses,
    tickers_analyzed: tickers,
    last_updated: new Date().toISOString(),
  };

  if (lastTicker) {
    summary.last_analysis_ticker = lastTicker;
  }
  if (lastTimestamp) {
    summary.last_analysis_date = lastTimestamp;
  }

  return summary;
}

// ============================================================================
// Service
// ============================================================================

export class KaiHistoryService {
  /**
   * Save a new analysis result to history.
   * Implements FIFO: prepends new entry, pops oldest if > MAX_HISTORY_PER_TICKER.
   *
   * Uses fetch-decrypt-merge-encrypt-save cycle to avoid overwriting other domains.
   */
  static async saveAnalysis(params: {
    userId: string;
    vaultKey: string;
    vaultOwnerToken?: string;
    entry: AnalysisHistoryEntry;
  }): Promise<boolean> {
    const { userId, vaultKey, vaultOwnerToken, entry } = params;

    try {
      // 1. Fetch existing encrypted blob
      const fullBlob = await WorldModelService.loadFullBlob({
        userId,
        vaultKey,
        vaultOwnerToken,
      }).catch((e) => {
        console.warn("[KaiHistory] Could not fetch/decrypt existing blob, starting fresh:", e);
        return {} as Record<string, unknown>;
      });

      // 2. Get or create the history map
      const existingHistory = fullBlob[DOMAIN];
      const historyMap: AnalysisHistoryMap =
        existingHistory &&
        typeof existingHistory === "object" &&
        !Array.isArray(existingHistory)
          ? (existingHistory as AnalysisHistoryMap)
          : {};

      // 3. Get or create the ticker array
      const tickerHistory = historyMap[entry.ticker] || [];

      // 4. Prepend new entry (newest first)
      tickerHistory.unshift(entry);

      // 5. FIFO: remove oldest if exceeds max
      if (tickerHistory.length > MAX_HISTORY_PER_TICKER) {
        tickerHistory.splice(MAX_HISTORY_PER_TICKER);
      }

      // 6. Update the map
      historyMap[entry.ticker] = tickerHistory;
      const summary = buildHistorySummary(historyMap, entry.ticker, entry.timestamp);

      // 7. Re-encrypt and store merged domain
      const result = await WorldModelService.storeMergedDomain({
        userId,
        vaultKey,
        domain: DOMAIN,
        domainData: historyMap as unknown as Record<string, unknown>,
        summary,
        vaultOwnerToken,
      });

      // Invalidate caches after successful save
      if (result.success) {
        const cache = CacheService.getInstance();
        cache.invalidate(CACHE_KEYS.DOMAIN_DATA(userId, DOMAIN));
        cache.invalidate(CACHE_KEYS.STOCK_CONTEXT(userId, entry.ticker));
        cache.invalidate(CACHE_KEYS.WORLD_MODEL_METADATA(userId));
      }

      return result.success;
    } catch (error) {
      console.error("[KaiHistory] Failed to save analysis:", error);
      return false;
    }
  }

  /**
   * Get analysis history for a specific ticker.
   *
   * @returns Array of AnalysisHistoryEntry (newest first), or empty array.
   */
  static async getTickerHistory(params: {
    userId: string;
    vaultKey: string;
    vaultOwnerToken?: string;
    ticker: string;
  }): Promise<AnalysisHistoryEntry[]> {
    try {
      const historyMap = await this.getAllHistory(params);
      return historyMap[params.ticker] || [];
    } catch {
      return [];
    }
  }

  /**
   * Get all analysis history across all tickers.
   */
  static async getAllHistory(params: {
    userId: string;
    vaultKey: string;
    vaultOwnerToken?: string;
  }): Promise<AnalysisHistoryMap> {
    const { userId, vaultKey, vaultOwnerToken } = params;

    try {
      const fullBlob = await WorldModelService.loadFullBlob({
        userId,
        vaultKey,
        vaultOwnerToken,
      });
      const history = fullBlob[DOMAIN];
      if (!history || typeof history !== "object" || Array.isArray(history)) {
        return {};
      }
      return history as AnalysisHistoryMap;
    } catch (error) {
      console.error("[KaiHistory] Failed to get history:", error);
      return {};
    }
  }

  /**
   * Delete a specific analysis entry.
   */
  static async deleteEntry(params: {
    userId: string;
    vaultKey: string;
    vaultOwnerToken?: string;
    ticker: string;
    timestamp: string;
  }): Promise<boolean> {
    const { userId, vaultKey, vaultOwnerToken, ticker, timestamp } = params;

    try {
      // 1. Fetch & Decrypt
      const fullBlob = await WorldModelService.loadFullBlob({
        userId,
        vaultKey,
        vaultOwnerToken,
      }).catch(() => ({} as Record<string, unknown>));

      // 2. Modify
      const existingHistory = fullBlob[DOMAIN];
      const historyMap: AnalysisHistoryMap =
        existingHistory &&
        typeof existingHistory === "object" &&
        !Array.isArray(existingHistory)
          ? (existingHistory as AnalysisHistoryMap)
          : {};
      if (!historyMap[ticker]) return false;

      const originalLen = historyMap[ticker].length;
      historyMap[ticker] = historyMap[ticker].filter((e) => e.timestamp !== timestamp);

      if (historyMap[ticker].length === 0) {
        delete historyMap[ticker];
      }

      if (historyMap[ticker]?.length === originalLen && historyMap[ticker]) {
        return false; // No change
      }

      // 3. Encrypt & Save
      const result = await WorldModelService.storeMergedDomain({
        userId,
        vaultKey,
        domain: DOMAIN,
        domainData: historyMap as unknown as Record<string, unknown>,
        summary: buildHistorySummary(historyMap),
        vaultOwnerToken,
      });

      if (result.success) {
        const cache = CacheService.getInstance();
        cache.invalidate(CACHE_KEYS.DOMAIN_DATA(userId, DOMAIN));
      }

      return result.success;
    } catch (error) {
      console.error("[KaiHistory] Failed to delete entry:", error);
      return false;
    }
  }

  /**
   * Delete all history for a specific ticker.
   */
  static async deleteTickerHistory(params: {
    userId: string;
    vaultKey: string;
    vaultOwnerToken?: string;
    ticker: string;
  }): Promise<boolean> {
    const { userId, vaultKey, vaultOwnerToken, ticker } = params;

    try {
      // 1. Fetch & Decrypt
      const fullBlob = await WorldModelService.loadFullBlob({
        userId,
        vaultKey,
        vaultOwnerToken,
      }).catch(() => ({} as Record<string, unknown>));

      // 2. Modify
      const existingHistory = fullBlob[DOMAIN];
      const historyMap: AnalysisHistoryMap =
        existingHistory &&
        typeof existingHistory === "object" &&
        !Array.isArray(existingHistory)
          ? (existingHistory as AnalysisHistoryMap)
          : {};
      if (!historyMap[ticker]) return false;

      delete historyMap[ticker];
      // 3. Encrypt & Save
      const result = await WorldModelService.storeMergedDomain({
        userId,
        vaultKey,
        domain: DOMAIN,
        domainData: historyMap as unknown as Record<string, unknown>,
        summary: buildHistorySummary(historyMap),
        vaultOwnerToken,
      });

      if (result.success) {
        const cache = CacheService.getInstance();
        cache.invalidate(CACHE_KEYS.DOMAIN_DATA(userId, DOMAIN));
        cache.invalidate(CACHE_KEYS.STOCK_CONTEXT(userId, ticker));
      }

      return result.success;
    } catch (error) {
      console.error("[KaiHistory] Failed to delete ticker history:", error);
      return false;
    }
  }
}

export default KaiHistoryService;
