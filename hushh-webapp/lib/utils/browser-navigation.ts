"use client";

function canUseWindow(): boolean {
  return typeof window !== "undefined";
}

export function assignWindowLocation(nextUrl: string): void {
  if (!canUseWindow()) return;
  window.location.assign(nextUrl);
}

export function replaceWindowLocation(nextUrl: string): void {
  if (!canUseWindow()) return;
  window.location.replace(nextUrl);
}

export function reloadWindow(): void {
  if (!canUseWindow()) return;
  window.location.reload();
}

export function openExternalUrl(url: string): void {
  if (!canUseWindow()) return;
  window.open(url, "_blank", "noopener,noreferrer");
}
