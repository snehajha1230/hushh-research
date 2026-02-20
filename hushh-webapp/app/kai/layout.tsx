"use client";

/**
 * Kai Layout - Minimal Mobile-First
 *
 * Wraps all /kai routes with VaultLockGuard and onboarding guard.
 */

import { VaultLockGuard } from "@/components/vault/vault-lock-guard";
import { KaiOnboardingGuard } from "@/components/kai/onboarding/kai-onboarding-guard";
import { KaiNavTour } from "@/components/kai/onboarding/kai-nav-tour";
import { VaultMethodPrompt } from "@/components/vault/vault-method-prompt";
import { usePathname } from "next/navigation";

export default function KaiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const onOnboardingRoute = pathname.startsWith("/kai/onboarding");
  const onImportRoute = pathname.startsWith("/kai/import");
  const shouldEnableMethodPrompt = !onOnboardingRoute && !onImportRoute;

  return (
    <VaultLockGuard>
      <KaiOnboardingGuard>
        <div className="flex flex-col min-h-screen">
          <main className="flex-1 pb-32">{children}</main>
          <VaultMethodPrompt enabled={shouldEnableMethodPrompt} />
          <KaiNavTour />
        </div>
      </KaiOnboardingGuard>
    </VaultLockGuard>
  );
}

