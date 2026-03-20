#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const webappRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(webappRoot, "..");
const registryPath = path.join(webappRoot, "mobile-parity-registry.json");

const SCAN_TARGETS = [
  "hushh-webapp/app",
  "hushh-webapp/components",
  "hushh-webapp/lib",
];

const CATEGORY_RULES = [
  {
    id: "clipboard_write",
    regex: /\bnavigator\.clipboard\.writeText\s*\(/,
  },
  {
    id: "navigation_mutation",
    regex: /window\.location\.(?:assign|replace|reload)\s*\(|window\.location\.href\s*=/,
  },
  {
    id: "window_open",
    regex: /\bwindow\.open\s*\(/,
  },
  {
    id: "local_storage",
    regex: /\b(?:window\.)?localStorage\./,
  },
  {
    id: "session_storage",
    regex: /\b(?:window\.)?sessionStorage\./,
  },
  {
    id: "indexed_db",
    regex: /\b(?:window\.)?indexedDB\b|["']indexedDB["']\s+in\s+window/,
  },
  {
    id: "blob_export",
    regex: /new Blob\s*\(|URL\.createObjectURL\s*\(/,
  },
  {
    id: "file_reader",
    regex: /new FileReader\s*\(/,
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalize(filePath) {
  return filePath.replace(/\\/g, "/");
}

function listCodeFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/\.(ts|tsx|js|jsx|cjs|mjs)$/.test(entry.name)) continue;
      if (/\.test\./.test(entry.name) || /\.spec\./.test(entry.name)) continue;
      out.push(full);
    }
  };
  walk(root);
  return out;
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*/")
  );
}

function stripQuotedText(line) {
  return line
    .replace(/`(?:\\.|[^`])*`/g, "``")
    .replace(/"(?:\\.|[^"])*"/g, "\"\"")
    .replace(/'(?:\\.|[^'])*'/g, "''");
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`OK: ${message}`);
}

function main() {
  if (!fs.existsSync(registryPath)) {
    throw new Error("Missing mobile-parity-registry.json");
  }

  const registry = readJson(registryPath);
  const allowed = registry.browserCompat?.allowedDirectUsage || {};
  const offenders = [];

  const files = SCAN_TARGETS.flatMap((target) =>
    listCodeFiles(path.join(repoRoot, target))
  );

  for (const filePath of files) {
    const relative = normalize(path.relative(repoRoot, filePath));
    const lines = fs.readFileSync(filePath, "utf8").split("\n");

    for (const rule of CATEGORY_RULES) {
      const allowedFiles = new Set(allowed[rule.id] || []);
      if (allowedFiles.has(relative)) {
        continue;
      }

      const lineNumber = lines.findIndex(
        (line) => !isCommentLine(line) && rule.regex.test(stripQuotedText(line))
      );
      if (lineNumber >= 0) {
        offenders.push(
          `${relative}:${lineNumber + 1} uses ${rule.id} directly`
        );
      }
    }
  }

  if (offenders.length) {
    fail(
      `Direct browser-only APIs found outside approved wrappers/exemptions:\n${offenders
        .map((item) => `- ${item}`)
        .join("\n")}`
    );
    process.exit(1);
  }

  ok("Route-facing browser APIs are wrapped or explicitly exempted");
}

main();
