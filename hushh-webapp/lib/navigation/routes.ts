/**
 * Central route contract for the web + Capacitor app.
 * Keep every app-level navigation target here to avoid drift.
 */

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  LOGOUT: "/logout",
  PRIVACY: "/privacy",
  DOCS: "/docs",
  PROFILE: "/profile",
  CONSENTS: "/consents",
  AGENT_NAV: "/agent-nav",
  ONBOARDING_PREFERENCES_LEGACY: "/onboarding/preferences",
  KAI_HOME: "/kai",
  KAI_ONBOARDING: "/kai/onboarding",
  KAI_IMPORT: "/kai/import",
  KAI_DASHBOARD: "/kai/dashboard",
} as const;

export const LEGACY_ROUTE_FALLBACKS = {
  DASHBOARD_ROOT: "/dashboard",
  DASHBOARD_KAI: "/dashboard/kai",
  DASHBOARD_KAI_WILDCARD: "/dashboard/kai/:path*",
  DASHBOARD_DOMAIN_WILDCARD: "/dashboard/domain/:path*",
  DASHBOARD_AGENT_NAV: "/dashboard/agent-nav",
} as const;

export function isKaiOnboardingRoute(pathname: string): boolean {
  return (
    pathname === ROUTES.KAI_ONBOARDING ||
    pathname.startsWith(`${ROUTES.KAI_ONBOARDING}/`)
  );
}

export function isPublicRoute(pathname: string): boolean {
  return (
    pathname === ROUTES.HOME ||
    pathname === ROUTES.LOGIN ||
    pathname === ROUTES.ONBOARDING_PREFERENCES_LEGACY ||
    pathname === ROUTES.DOCS ||
    pathname === ROUTES.LOGOUT ||
    pathname === ROUTES.PRIVACY ||
    pathname === ROUTES.PROFILE
  );
}
