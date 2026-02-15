import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LEGACY_ROUTE_SEGMENTS = ["kai", "dashboard", "preferences"];
const LEGACY_ROUTE = `/${LEGACY_ROUTE_SEGMENTS.join("/")}`;

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      out.push(...collectFiles(full));
      continue;
    }
    if (/\.(ts|tsx|md|json)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("Kai legacy preferences cleanup", () => {
  it("removes the legacy dashboard preferences page", () => {
    const legacyPagePath = join(
      process.cwd(),
      "app",
      "kai",
      "dashboard",
      "preferences",
      "page.tsx"
    );
    expect(existsSync(legacyPagePath)).toBe(false);
  });

  it("has no source references to the legacy dashboard preferences route", () => {
    const roots = ["app", "components", "lib", "docs"];
    const hits: string[] = [];

    for (const root of roots) {
      const rootPath = join(process.cwd(), root);
      if (!existsSync(rootPath)) continue;
      for (const file of collectFiles(rootPath)) {
        const text = readFileSync(file, "utf8");
        if (text.includes(LEGACY_ROUTE)) {
          hits.push(file);
        }
      }
    }

    const routeContracts = readFileSync(join(process.cwd(), "route-contracts.json"), "utf8");
    if (routeContracts.includes(LEGACY_ROUTE)) {
      hits.push("route-contracts.json");
    }

    expect(hits).toEqual([]);
  });
});
