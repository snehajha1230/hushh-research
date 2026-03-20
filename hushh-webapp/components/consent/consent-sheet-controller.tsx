"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ConsentCenterView } from "@/components/consent/consent-center-view";
import { SettingsDetailPanel } from "@/components/profile/settings-ui";
import {
  applyConsentSheetParams,
  clearConsentSheetParams,
  CONSENT_LEGACY_PANEL_QUERY_KEY,
  CONSENT_LEGACY_PANEL_VALUE,
  CONSENT_SHEET_QUERY_KEY,
  CONSENT_SHEET_QUERY_VALUE,
  CONSENT_SHEET_VIEW_QUERY_KEY,
  normalizeConsentSheetView,
  type ConsentSheetView,
} from "@/lib/consent/consent-sheet-route";
import { ROUTES } from "@/lib/navigation/routes";

type ConsentSheetContextValue = {
  isOpen: boolean;
  view: ConsentSheetView;
  openConsentSheet: (options?: { view?: ConsentSheetView }) => void;
  closeConsentSheet: () => void;
};

const ConsentSheetContext = createContext<ConsentSheetContextValue>({
  isOpen: false,
  view: "pending",
  openConsentSheet: () => {},
  closeConsentSheet: () => {},
});

function buildNextUrl(pathname: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function ConsentSheetProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const isLegacyProfileConsentPanel =
    pathname === ROUTES.PROFILE &&
    searchParams.get(CONSENT_LEGACY_PANEL_QUERY_KEY) === CONSENT_LEGACY_PANEL_VALUE;
  const isOpen =
    searchParams.get(CONSENT_SHEET_QUERY_KEY) === CONSENT_SHEET_QUERY_VALUE ||
    isLegacyProfileConsentPanel;
  const view = normalizeConsentSheetView(
    searchParams.get(CONSENT_SHEET_VIEW_QUERY_KEY) ?? searchParams.get("view")
  );

  const openConsentSheet = useCallback(
    (options?: { view?: ConsentSheetView }) => {
      const params = applyConsentSheetParams(new URLSearchParams(searchParamsString), {
        ensurePrivacyTab: pathname === ROUTES.PROFILE,
        view: options?.view,
      });
      router.replace(buildNextUrl(pathname, params), { scroll: false });
    },
    [pathname, router, searchParamsString]
  );

  const closeConsentSheet = useCallback(() => {
    const params = clearConsentSheetParams(new URLSearchParams(searchParamsString));
    router.replace(buildNextUrl(pathname, params), { scroll: false });
  }, [pathname, router, searchParamsString]);

  const value = useMemo(
    () => ({
      isOpen,
      view,
      openConsentSheet,
      closeConsentSheet,
    }),
    [closeConsentSheet, isOpen, openConsentSheet, view]
  );

  return (
    <ConsentSheetContext.Provider value={value}>
      {children}
      <SettingsDetailPanel
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) closeConsentSheet();
        }}
        title="Consent center"
        description="Review pending approvals, active grants, and your consent history without leaving the current flow."
      >
        <ConsentCenterView embedded initialView={view} />
      </SettingsDetailPanel>
    </ConsentSheetContext.Provider>
  );
}

export function useConsentSheet() {
  return useContext(ConsentSheetContext);
}
