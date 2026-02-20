import { ClientRedirect } from "@/components/navigation/client-redirect";
import { ROUTES } from "@/lib/navigation/routes";

export const dynamicParams = false;

const LEGACY_KAI_PATHS = [
  ["analysis"],
  ["manage"],
  ["portfolio-health"],
  ["losers-analysis"],
] as const;

export function generateStaticParams() {
  return LEGACY_KAI_PATHS.map((path) => ({ path: [...path] }));
}

export default async function LegacyDashboardKaiPathRedirectPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const resolved = await params;
  const suffix = Array.isArray(resolved.path) && resolved.path.length > 0
    ? `/${resolved.path.join("/")}`
    : "";

  return <ClientRedirect to={`${ROUTES.KAI_DASHBOARD}${suffix}`} />;
}
