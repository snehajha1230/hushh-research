import { ClientRedirect } from "@/components/navigation/client-redirect";
import { ROUTES } from "@/lib/navigation/routes";

export const dynamicParams = false;

const LEGACY_DOMAIN_PATHS = [
  ["financial"],
  ["identity"],
  ["preferences"],
  ["vault"],
] as const;

export function generateStaticParams() {
  return LEGACY_DOMAIN_PATHS.map((path) => ({ path: [...path] }));
}

export default function LegacyDashboardDomainRedirectPage() {
  return <ClientRedirect to={ROUTES.KAI_HOME} />;
}
