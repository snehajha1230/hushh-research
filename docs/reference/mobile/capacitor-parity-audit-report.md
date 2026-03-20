# Capacitor Parity Audit Report

Last audited: March 19, 2026

## Overall Status

Current status: release-gate pass with explicit accepted exceptions.

The following all pass together:

- `npm run verify:routes`
- `npm run verify:parity`
- `npm run verify:capacitor:routes`
- `npm run verify:capacitor:config`
- `npm run verify:mobile-firebase`
- `npm run verify:docs`
- `npm run verify:native:browser-compat`
- `npm run verify:capacitor:audit`
- `xcodebuild -list -project ios/App/App.xcodeproj`
- `./gradlew tasks --all`

## Blockers

None at the time of this audit.

The repo now hard-fails when:

- a visible page route is not declared in `route-contracts.json`
- a declared visible page route is not classified in `mobile-parity-registry.json`
- route-facing browser-only APIs bypass shared wrappers or explicit exemptions
- docs drift from the current runtime/native contract

## Accepted Exceptions

### 1. Android native passkey PRF

- Status: accepted exception
- Scope: Android native parity only
- Current behavior:
  - iOS PRF passkey flow is implemented
  - Android PRF native methods are still pending
  - biometric/passphrase fallback remains active

### 2. Cloud-backed vault preference methods

- Status: accepted exception
- Scope: vault preference flows
- Current behavior:
  - `storePreferencesToCloud()` is the canonical native-safe write path
  - `deletePreferences()` is intentionally unsupported in the web fallback
  - new mobile product flows should not assume local-only preference deletion parity

## Advisory Follow-Up

### 1. Keep route classification current

Any new visible page must be added to:

- `hushh-webapp/route-contracts.json`
- `hushh-webapp/mobile-parity-registry.json`

### 2. Keep browser APIs behind wrappers

Route-facing code should continue to use:

- `hushh-webapp/lib/utils/clipboard.ts`
- `hushh-webapp/lib/utils/browser-navigation.ts`
- `hushh-webapp/lib/utils/session-storage.ts`
- `hushh-webapp/lib/utils/native-download.ts`

### 3. Keep Apple capability docs aligned

If entitlements change, update:

- `deploy/apple_app_id_capabilities.md`
- `deploy/app_store_deployment.md`
- `docs/guides/mobile.md`

in the same change.
