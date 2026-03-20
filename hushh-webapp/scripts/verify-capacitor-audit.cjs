#!/usr/bin/env node

const { execSync } = require("node:child_process");
const path = require("node:path");

const webappRoot = path.resolve(__dirname, "..");
const androidRoot = path.join(webappRoot, "android");

function run(label, command, cwd = webappRoot) {
  console.log(`\n==> ${label}`);
  execSync(command, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
}

function main() {
  run("Verify full route contracts", "node scripts/verify-route-contracts.cjs");
  run("Verify native plugin parity", "node scripts/verify-native-parity.cjs");
  run("Verify Capacitor route classification", "node scripts/verify-capacitor-routes.cjs");
  run("Verify Capacitor runtime config", "node scripts/verify-capacitor-runtime-config.cjs");
  run("Verify mobile Firebase artifact safety", "node scripts/verify-mobile-firebase.cjs");
  run("Verify docs/runtime parity", "node ../scripts/verify-doc-runtime-parity.cjs");
  run("Verify browser API native compatibility", "node scripts/verify-native-browser-compat.cjs");
  run("Verify iOS project sanity", "xcodebuild -list -project ios/App/App.xcodeproj");
  run("Verify Android project sanity", "./gradlew tasks --all", androidRoot);

  console.log("\nCapacitor parity audit PASSED");
}

main();
