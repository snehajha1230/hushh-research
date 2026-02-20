"use client";

import { PreVaultOnboardingService } from "@/lib/services/pre-vault-onboarding-service";
import { VaultService } from "@/lib/services/vault-service";
import { ROUTES } from "@/lib/navigation/routes";

const PRE_VAULT_ROUTE = ROUTES.KAI_ONBOARDING;
const NO_VAULT_DEFAULT_ROUTE = ROUTES.KAI_HOME;

function normalizeRedirectPath(path: string | null | undefined): string {
  if (!path || !path.trim()) return ROUTES.KAI_HOME;
  return path;
}

export class PostAuthRouteService {
  static async resolveAfterLogin(params: {
    userId: string;
    redirectPath?: string;
  }): Promise<string> {
    const fallbackRoute = normalizeRedirectPath(params.redirectPath);

    try {
      const hasVault = await VaultService.checkVault(params.userId);
      if (hasVault) {
        return fallbackRoute;
      }

      const pending = await PreVaultOnboardingService.load(params.userId);
      if (pending?.completed) {
        return NO_VAULT_DEFAULT_ROUTE;
      }

      return PRE_VAULT_ROUTE;
    } catch (error) {
      console.warn("[PostAuthRouteService] Failed to resolve post-auth route:", error);
      return fallbackRoute;
    }
  }
}
