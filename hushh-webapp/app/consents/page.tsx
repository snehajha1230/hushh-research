import { redirect } from "next/navigation";

import {
  buildConsentSheetProfileHref,
  normalizeConsentSheetView,
} from "@/lib/consent/consent-sheet-route";

export default function ConsentsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const resolvedSearchParams = searchParams ?? {};
  const rawView = Array.isArray(resolvedSearchParams.view)
    ? resolvedSearchParams.view[0]
    : resolvedSearchParams.view;

  redirect(buildConsentSheetProfileHref(normalizeConsentSheetView(rawView)));
}
