"use client";

import { useEffect, useRef } from "react";

import { useAuth } from "@/hooks/use-auth";
import { PostUnlockSyncService } from "@/lib/services/post-unlock-sync-service";
import { useVault } from "@/lib/vault/vault-context";

/**
 * Syncs locally captured pre-vault onboarding answers into encrypted kai_profile
 * after vault creation/unlock succeeds.
 */
export function PostAuthOnboardingSyncBridge() {
  const { user, loading } = useAuth();
  const { isVaultUnlocked, vaultKey, vaultOwnerToken } = useVault();
  const syncingRef = useRef(false);
  const lastSyncedSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !user || !isVaultUnlocked || !vaultKey || !vaultOwnerToken) {
      return;
    }

    const signature = `${user.uid}:${vaultOwnerToken}`;
    if (lastSyncedSignatureRef.current === signature) {
      return;
    }

    if (syncingRef.current) {
      return;
    }

    syncingRef.current = true;
    lastSyncedSignatureRef.current = signature;

    void PostUnlockSyncService.run({
      userId: user.uid,
      vaultKey,
      vaultOwnerToken,
    })
      .catch((error) => {
        lastSyncedSignatureRef.current = null;
        console.warn(
          "[PostAuthOnboardingSyncBridge] Post-unlock sync failed, will retry later:",
          error
        );
      })
      .finally(() => {
        syncingRef.current = false;
      });
  }, [loading, user?.uid, isVaultUnlocked, vaultKey, vaultOwnerToken]);

  return null;
}
