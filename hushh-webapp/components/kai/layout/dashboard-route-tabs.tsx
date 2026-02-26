"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { useKaiBottomChromeVisibility } from "@/lib/navigation/kai-bottom-chrome-visibility";
import {
  activeKaiRouteTabFromPath,
  KAI_ROUTE_TABS,
} from "@/lib/navigation/kai-route-tabs";
import { useKaiSession } from "@/lib/stores/kai-session-store";
import { ROUTES } from "@/lib/navigation/routes";
import { cn } from "@/lib/utils";
import { scrollAppToTop } from "@/lib/navigation/use-scroll-reset";
import { morphyToast as toast } from "@/lib/morphy-ux/morphy";

const SWIPE_MIN_DISTANCE_PX = 54;
const SWIPE_VERTICAL_LIMIT_PX = 56;
const SWIPE_DIRECTION_RATIO = 1.2;

function hasHorizontalScrollParent(target: HTMLElement | null): boolean {
  if (!target || typeof window === "undefined") return false;
  let node: HTMLElement | null = target;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowX = style.overflowX;
    const canScroll =
      (overflowX === "auto" || overflowX === "scroll") &&
      node.scrollWidth > node.clientWidth + 4;
    if (canScroll) return true;
    node = node.parentElement;
  }
  return false;
}

function shouldIgnoreGlobalSwipeTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;

  if (element.closest('[data-tour-id="kai-route-tabs"]')) {
    return false;
  }

  if (
    element.closest(
      'input, textarea, select, [contenteditable="true"], [data-no-route-swipe], [data-slot="dialog-content"], [data-slot="sheet-content"], [data-slot="alert-dialog-content"], [data-slot="command"], [cmdk-root]'
    )
  ) {
    return true;
  }

  if (
    element.closest(
      '[data-slot="carousel"], [data-slot="carousel-content"], [data-slot="carousel-item"]'
    )
  ) {
    return true;
  }

  if (hasHorizontalScrollParent(element)) {
    return true;
  }

  return false;
}

export function DashboardRouteTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const hideTabsForPath =
    pathname.startsWith(ROUTES.KAI_ONBOARDING) || pathname.startsWith(ROUTES.KAI_IMPORT);
  const [mounted, setMounted] = useState(false);
  const { hidden: hideRouteTabs } = useKaiBottomChromeVisibility(!hideTabsForPath);
  const busyOperations = useKaiSession((s) => s.busyOperations);

  const activeTab = useMemo(
    () => activeKaiRouteTabFromPath(pathname || ROUTES.KAI_HOME),
    [pathname]
  );

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    for (const tab of KAI_ROUTE_TABS) {
      router.prefetch(tab.prefetchHref);
    }
  }, [mounted, router]);

  const handleTabChange = useCallback(
    (nextTab: string) => {
      if (busyOperations["portfolio_save"]) {
        toast.info("Saving to vault. Please wait until encryption completes.");
        return;
      }
      const target = KAI_ROUTE_TABS.find((tab) => tab.id === nextTab);
      if (!target || target.id === activeTab) return;
      scrollAppToTop("auto");
      router.push(target.href);
    },
    [activeTab, busyOperations, router]
  );

  useEffect(() => {
    if (!mounted || hideTabsForPath || typeof document === "undefined") {
      return;
    }

    const swipeSurface: Document | HTMLElement =
      document.querySelector<HTMLElement>("[data-app-scroll-root='true']") ?? document;

    let startX: number | null = null;
    let startY: number | null = null;
    let tracking = false;
    let gestureAxis: "undecided" | "horizontal" | "vertical" = "undecided";
    let ignoredTarget = false;

    const resetGesture = () => {
      startX = null;
      startY = null;
      tracking = false;
      gestureAxis = "undecided";
      ignoredTarget = false;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        resetGesture();
        return;
      }

      ignoredTarget = shouldIgnoreGlobalSwipeTarget(event.target);
      if (ignoredTarget) {
        resetGesture();
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        resetGesture();
        return;
      }

      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      gestureAxis = "undecided";
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!tracking || ignoredTarget || event.touches.length === 0) {
        return;
      }

      const touch = event.touches[0];
      if (!touch || startX === null || startY === null) {
        return;
      }

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (gestureAxis === "undecided") {
        if (absX < 6 && absY < 6) {
          return;
        }

        if (absY > absX * 1.1) {
          gestureAxis = "vertical";
          tracking = false;
          return;
        }

        if (absX > absY * 1.1) {
          gestureAxis = "horizontal";
        } else {
          return;
        }
      }

      if (
        gestureAxis !== "horizontal" ||
        absY > Math.max(20, absX * SWIPE_DIRECTION_RATIO)
      ) {
        tracking = false;
        return;
      }

      event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking || ignoredTarget || event.changedTouches.length === 0) {
        resetGesture();
        return;
      }

      const touch = event.changedTouches[0];
      if (!touch || startX === null || startY === null) {
        resetGesture();
        return;
      }

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const finalAxis = gestureAxis;
      resetGesture();

      if (
        finalAxis !== "horizontal" ||
        absY > SWIPE_VERTICAL_LIMIT_PX ||
        absX < SWIPE_MIN_DISTANCE_PX ||
        absX < absY * SWIPE_DIRECTION_RATIO
      ) {
        return;
      }

      const activeIndex = Math.max(
        0,
        KAI_ROUTE_TABS.findIndex((tab) => tab.id === activeTab)
      );
      const direction = deltaX < 0 ? 1 : -1;
      const target = KAI_ROUTE_TABS[activeIndex + direction];
      if (!target) return;
      if (busyOperations["portfolio_save"]) {
        toast.info("Saving to vault. Please wait until encryption completes.");
        return;
      }

      scrollAppToTop("auto");
      router.push(target.href);
    };

    const onTouchCancel = () => resetGesture();

    const touchStartListener: EventListener = (event) => onTouchStart(event as TouchEvent);
    const touchMoveListener: EventListener = (event) => onTouchMove(event as TouchEvent);
    const touchEndListener: EventListener = (event) => onTouchEnd(event as TouchEvent);
    const touchCancelListener: EventListener = () => onTouchCancel();

    swipeSurface.addEventListener("touchstart", touchStartListener, { passive: true });
    swipeSurface.addEventListener("touchmove", touchMoveListener, { passive: false });
    swipeSurface.addEventListener("touchend", touchEndListener, { passive: true });
    swipeSurface.addEventListener("touchcancel", touchCancelListener, { passive: true });

    return () => {
      swipeSurface.removeEventListener("touchstart", touchStartListener);
      swipeSurface.removeEventListener("touchmove", touchMoveListener);
      swipeSurface.removeEventListener("touchend", touchEndListener);
      swipeSurface.removeEventListener("touchcancel", touchCancelListener);
    };
  }, [mounted, hideTabsForPath, activeTab, busyOperations, router]);

  if (!mounted || typeof document === "undefined" || hideTabsForPath) {
    return null;
  }

  const activeTabIndex = Math.max(
    0,
    KAI_ROUTE_TABS.findIndex((tab) => tab.id === activeTab)
  );

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[45]"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + var(--app-top-safe-offset, 0px) + var(--app-top-bar-height, 72px))",
      }}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 -top-10 h-[126px] bar-glass bar-glass-top transform-gpu transition-all duration-300 ease-out will-change-transform",
          hideRouteTabs ? "opacity-0" : "opacity-100"
        )}
        style={{
          transform: hideRouteTabs
            ? "translate3d(0, calc(-100% - 10px), 0)"
            : "translate3d(0, 0, 0)",
        }}
      />
      <div
        className={cn(
          "relative mx-auto flex w-full max-w-6xl justify-center px-4 transform-gpu transition-all duration-300 ease-out will-change-transform sm:px-6",
          hideRouteTabs ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
        )}
        style={{
          transform: hideRouteTabs
            ? "translate3d(0, calc(-100% - 10px), 0)"
            : "translate3d(0, 0, 0)",
        }}
      >
        <div
          data-tour-id="kai-route-tabs"
          className="pointer-events-auto w-full max-w-[460px] overflow-hidden"
        >
          <div className="relative grid grid-cols-3 items-center border-b border-border/65 px-1">
            {KAI_ROUTE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "relative z-[1] h-9 text-sm font-semibold transition-colors duration-200",
                  tab.id === activeTab
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={tab.id === activeTab ? "page" : undefined}
              >
                {tab.label}
              </button>
            ))}
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-px left-0 h-[2px] bg-primary transition-transform duration-250 ease-out"
              style={{
                width: `calc(100% / ${KAI_ROUTE_TABS.length})`,
                transform: `translate3d(${activeTabIndex * 100}%, 0, 0)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
