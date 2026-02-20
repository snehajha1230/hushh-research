import type { PortfolioData } from "@/lib/cache/cache-context";
import { CacheService, CACHE_KEYS, CACHE_TTL } from "@/lib/services/cache-service";

/**
 * Deterministic cache mutation coordinator for all DB-backed CRUD paths.
 * Services/components should call this instead of ad-hoc invalidation logic.
 */
export class CacheSyncService {
  static onWorldModelDomainStored(
    userId: string,
    domain: string,
    options?: {
      portfolioData?: PortfolioData;
    }
  ): void {
    const cache = CacheService.getInstance();

    if (domain === "financial" && options?.portfolioData) {
      cache.set(CACHE_KEYS.PORTFOLIO_DATA(userId), options.portfolioData, CACHE_TTL.SESSION);
      cache.set(
        CACHE_KEYS.DOMAIN_DATA(userId, "financial"),
        options.portfolioData,
        CACHE_TTL.SESSION
      );
    } else {
      cache.invalidate(CACHE_KEYS.DOMAIN_DATA(userId, domain));
      if (domain === "financial") {
        cache.invalidate(CACHE_KEYS.PORTFOLIO_DATA(userId));
      }
    }

    cache.invalidate(CACHE_KEYS.WORLD_MODEL_METADATA(userId));
  }

  static onWorldModelDomainCleared(userId: string, domain: string): void {
    const cache = CacheService.getInstance();
    cache.invalidate(CACHE_KEYS.DOMAIN_DATA(userId, domain));
    cache.invalidate(CACHE_KEYS.WORLD_MODEL_METADATA(userId));
    if (domain === "financial") {
      cache.invalidate(CACHE_KEYS.PORTFOLIO_DATA(userId));
    }
  }

  static onPortfolioUpserted(userId: string, portfolioData: PortfolioData): void {
    const cache = CacheService.getInstance();
    cache.set(CACHE_KEYS.PORTFOLIO_DATA(userId), portfolioData, CACHE_TTL.SESSION);
    cache.set(CACHE_KEYS.DOMAIN_DATA(userId, "financial"), portfolioData, CACHE_TTL.SESSION);
    cache.invalidate(CACHE_KEYS.WORLD_MODEL_METADATA(userId));
  }

  static onVaultStateChanged(
    userId: string,
    options?: {
      hasVault?: boolean;
    }
  ): void {
    const cache = CacheService.getInstance();
    if (typeof options?.hasVault === "boolean") {
      cache.set(CACHE_KEYS.VAULT_CHECK(userId), options.hasVault, CACHE_TTL.SESSION);
    } else {
      cache.invalidate(CACHE_KEYS.VAULT_CHECK(userId));
    }
    cache.invalidate(CACHE_KEYS.VAULT_STATUS(userId));
  }

  static onConsentMutated(userId: string): void {
    const cache = CacheService.getInstance();
    cache.invalidate(CACHE_KEYS.ACTIVE_CONSENTS(userId));
    cache.invalidate(CACHE_KEYS.PENDING_CONSENTS(userId));
    cache.invalidate(CACHE_KEYS.CONSENT_AUDIT_LOG(userId));
    cache.invalidate(CACHE_KEYS.VAULT_STATUS(userId));
  }

  static onAnalysisHistoryMutated(userId: string, ticker?: string): void {
    const cache = CacheService.getInstance();
    cache.invalidate(CACHE_KEYS.DOMAIN_DATA(userId, "kai_analysis_history"));
    cache.invalidate(CACHE_KEYS.WORLD_MODEL_METADATA(userId));
    if (ticker) {
      cache.invalidate(CACHE_KEYS.STOCK_CONTEXT(userId, ticker.toUpperCase()));
    }
  }

  static onAuthSignedOut(userId?: string | null): void {
    const cache = CacheService.getInstance();
    if (userId) {
      cache.invalidateUser(userId);
      return;
    }
    cache.clear();
  }

  static onAccountDeleted(userId?: string | null): void {
    this.onAuthSignedOut(userId ?? null);
  }
}
