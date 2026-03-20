# Consent UI North Star

This folder owns the shared consent center experience and all consent launchers.

## Start Here

- `consent-sheet-controller.tsx`: single app-level consent sheet controller.
- `consent-center-view.tsx`: shared consent center content surface.
- `notification-provider.tsx`: pending consent count, delivery state, and bell summary data.

## Rules

1. There is one consent center experience.
2. `/consents` is a compatibility alias, not a second consent UI.
3. Bell, profile, and compatibility entrypoints must all open the same shared sheet path.
