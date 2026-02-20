#!/usr/bin/env node
/*
 * verify-capacitor-routes.cjs
 *
 * Hard-fail checks for Capacitor/export-safe routing.
 * We do not rely on Next.js redirects alone for mobile static export.
 */

const fs = require("node:fs");
const path = require("node:path");

const webappRoot = path.resolve(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(webappRoot, relPath), "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.join(webappRoot, relPath));
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK: ${message}`);
}

const CANONICAL_ROUTE_FILES = [
  "app/login/page.tsx",
  "app/kai/page.tsx",
  "app/kai/onboarding/page.tsx",
  "app/kai/import/page.tsx",
  "app/kai/dashboard/page.tsx",
];

const MOBILE_COMPAT_REDIRECT_FILES = [
  "app/onboarding/preferences/page.tsx",
  "app/dashboard/kai/page.tsx",
  "app/dashboard/kai/[...path]/page.tsx",
  "app/dashboard/domain/[...path]/page.tsx",
  "app/dashboard/agent-nav/page.tsx",
];

function assertFilesExist() {
  for (const rel of [...CANONICAL_ROUTE_FILES, ...MOBILE_COMPAT_REDIRECT_FILES]) {
    if (!exists(rel)) {
      fail(`Missing required route file: ${rel}`);
    }
  }
  ok("Canonical and compatibility route files exist");
}

function assertLegacyOnboardingPageIsClientRedirect() {
  const rel = "app/onboarding/preferences/page.tsx";
  const src = read(rel);

  if (!src.includes('"use client"') && !src.includes("'use client'")) {
    fail(`${rel} must be a client redirect page for static export compatibility`);
  }

  if (src.includes("redirect(")) {
    fail(`${rel} must not use server redirect() in export/mobile mode`);
  }

  if (!src.includes("router.replace")) {
    fail(`${rel} must use router.replace(...) fallback redirect`);
  }

  ok("Legacy onboarding page uses client-side fallback redirect");
}

function assertCompatibilityPagesAreExportSafe() {
  for (const rel of MOBILE_COMPAT_REDIRECT_FILES) {
    if (rel === "app/onboarding/preferences/page.tsx") continue;

    const src = read(rel);

    const isClientRedirect =
      (src.includes('"use client"') || src.includes("'use client'")) &&
      src.includes("router.replace");
    const isStaticServerRedirect =
      src.includes("generateStaticParams") && src.includes("ClientRedirect");

    if (!isClientRedirect && !isStaticServerRedirect) {
      fail(
        `${rel} must be either a client router.replace redirect page or a static server page using generateStaticParams + ClientRedirect`
      );
    }
  }

  ok("Compatibility route pages use export-safe redirect fallbacks");
}

function assertNextConfigRedirectCoverage() {
  const src = read("next.config.ts");
  const requiredRedirectSources = [
    "/onboarding/preferences",
    "/dashboard/kai",
    "/dashboard/kai/:path*",
    "/dashboard/domain/:path*",
    "/dashboard/agent-nav",
  ];

  for (const source of requiredRedirectSources) {
    if (!src.includes(`source: \"${source}\"`) && !src.includes(`source: '${source}'`)) {
      fail(`next.config.ts missing redirect source ${source}`);
    }
  }

  ok("next.config.ts redirect coverage present (web mode)");
}

function assertNoRedirectOnlyDependencies() {
  // If a mobile-critical alias exists in next.config redirects,
  // there must also be a page-level fallback in app/.
  const mapping = [
    ["/onboarding/preferences", "app/onboarding/preferences/page.tsx"],
    ["/dashboard/kai", "app/dashboard/kai/page.tsx"],
    ["/dashboard/kai/:path*", "app/dashboard/kai/[...path]/page.tsx"],
    ["/dashboard/domain/:path*", "app/dashboard/domain/[...path]/page.tsx"],
    ["/dashboard/agent-nav", "app/dashboard/agent-nav/page.tsx"],
  ];

  for (const [source, fallbackFile] of mapping) {
    if (!exists(fallbackFile)) {
      fail(`Mobile-critical alias ${source} has no export-safe fallback page (${fallbackFile})`);
    }
  }

  ok("Mobile-critical aliases have export-safe fallback pages");
}

function main() {
  assertFilesExist();
  assertLegacyOnboardingPageIsClientRedirect();
  assertCompatibilityPagesAreExportSafe();
  assertNextConfigRedirectCoverage();
  assertNoRedirectOnlyDependencies();

  if (process.exitCode) {
    console.error("\nCapacitor route verification FAILED");
    process.exit(1);
  }

  console.log("\nCapacitor route verification PASSED");
}

main();
