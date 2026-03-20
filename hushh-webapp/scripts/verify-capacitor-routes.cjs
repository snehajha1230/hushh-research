#!/usr/bin/env node
/*
 * verify-capacitor-routes.cjs
 *
 * Hard-fail checks for Capacitor/export-safe routing.
 * We do not rely on Next.js redirects alone for mobile static export.
 *
 * Full visible-route coverage is derived from route-contracts.json pageContracts[]
 * and classified in mobile-parity-registry.json.
 */

const fs = require("node:fs");
const path = require("node:path");

const webappRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webappRoot, "..");

function read(relPath) {
  return fs.readFileSync(path.join(webappRoot, relPath), "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.join(webappRoot, relPath));
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK: ${message}`);
}

const CANONICAL_ROUTE_FILES = [
  "app/page.tsx",
  "app/login/page.tsx",
  "app/kai/page.tsx",
  "app/kai/onboarding/page.tsx",
  "app/kai/import/page.tsx",
  "app/kai/dashboard/page.tsx",
];

const LEGACY_ALIAS_FILES = [
  "app/onboarding/preferences/page.tsx",
  "app/dashboard/page.tsx",
  "app/dashboard/kai/page.tsx",
  "app/dashboard/kai/[...path]/page.tsx",
  "app/dashboard/domain/[...path]/page.tsx",
  "app/dashboard/agent-nav/page.tsx",
];

function listPageRouteFiles() {
  const appDir = path.join(webappRoot, "app");
  const out = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "api") continue;
        walk(full);
        continue;
      }
      if (entry.isFile() && entry.name === "page.tsx") {
        out.push(path.relative(repoRoot, full).replace(/\\/g, "/"));
      }
    }
  };

  walk(appDir);
  return out;
}

function assertFilesExist() {
  for (const rel of CANONICAL_ROUTE_FILES) {
    if (!exists(rel)) {
      fail(`Missing required route file: ${rel}`);
    }
  }
  ok("Canonical route files exist");
}

function assertLegacyAliasesRemoved() {
  for (const rel of LEGACY_ALIAS_FILES) {
    if (exists(rel)) {
      fail(`Legacy alias route file must be removed: ${rel}`);
    }
  }
  ok("Legacy alias route files are removed");
}

function assertNextConfigHasNoLegacyRedirects() {
  const src = read("next.config.ts");
  const disallowedRedirectSources = [
    "/dashboard",
    "/onboarding/preferences",
    "/dashboard/kai",
    "/dashboard/kai/:path*",
    "/dashboard/domain/:path*",
    "/dashboard/agent-nav",
  ];

  for (const source of disallowedRedirectSources) {
    if (src.includes(`source: \"${source}\"`) || src.includes(`source: '${source}'`)) {
      fail(`next.config.ts must not include legacy redirect source ${source}`);
    }
  }

  ok("next.config.ts does not define legacy alias redirects");
}

function assertAllVisibleRoutesAreClassified() {
  const contracts = readJson("route-contracts.json");
  const registry = readJson("mobile-parity-registry.json");

  const actualPageFiles = new Set(listPageRouteFiles());
  const manifestPageContracts = contracts.pageContracts || [];
  const manifestPageIds = new Set(manifestPageContracts.map((entry) => entry.id));
  const classifiedIds = new Set([
    ...(registry.nativeSupportedPageContractIds || []),
    ...(registry.webOnlyExemptPageContractIds || []),
  ]);

  const missingPageFiles = manifestPageContracts
    .map((entry) => entry.pageFile)
    .filter((file) => !actualPageFiles.has(file));
  if (missingPageFiles.length) {
    fail(
      `Route contract pageFiles missing on disk:\n${missingPageFiles
        .map((file) => `- ${file}`)
        .join("\n")}`
    );
  }

  const unclassified = manifestPageContracts
    .map((entry) => entry.id)
    .filter((id) => !classifiedIds.has(id));
  if (unclassified.length) {
    fail(
      `Visible page contracts missing mobile parity classification:\n${unclassified
        .map((id) => `- ${id}`)
        .join("\n")}`
    );
  }

  const unknownClassifications = [...classifiedIds].filter(
    (id) => !manifestPageIds.has(id)
  );
  if (unknownClassifications.length) {
    fail(
      `Mobile parity registry references unknown page contracts:\n${unknownClassifications
        .map((id) => `- ${id}`)
        .join("\n")}`
    );
  }

  ok("All visible page contracts are classified for Capacitor parity");
}

function main() {
  assertFilesExist();
  assertLegacyAliasesRemoved();
  assertNextConfigHasNoLegacyRedirects();
  assertAllVisibleRoutesAreClassified();

  if (process.exitCode) {
    console.error("\nCapacitor route verification FAILED");
    process.exit(1);
  }

  console.log("\nCapacitor route verification PASSED");
}

main();
