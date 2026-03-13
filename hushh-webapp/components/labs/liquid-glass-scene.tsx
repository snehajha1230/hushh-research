"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type LiquidGlassSceneContextValue = {
  sceneStyle: CSSProperties;
  sceneRootRef: React.MutableRefObject<HTMLDivElement | null>;
  sceneVersion: number;
  parentSceneRootRef: React.MutableRefObject<HTMLDivElement | null> | null;
  parentSceneVersion: number;
};

const LiquidGlassSceneContext = createContext<LiquidGlassSceneContextValue | null>(null);

export function LiquidGlassSceneProvider({
  sceneStyle,
  children,
}: {
  sceneStyle: CSSProperties;
  children: ReactNode;
}) {
  const parentContext = useContext(LiquidGlassSceneContext);
  const sceneRootRef = useRef<HTMLDivElement | null>(null);
  const [sceneVersion, setSceneVersion] = useState(0);

  useEffect(() => {
    const node = sceneRootRef.current;
    if (!node) return;

    let rafId: number | null = null;
    const bump = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        setSceneVersion((value) => value + 1);
      });
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(bump) : null;
    resizeObserver?.observe(node);

    const mutationObserver =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(() => bump())
        : null;
    mutationObserver?.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    node.addEventListener("scroll", bump, { passive: true });
    window.addEventListener("resize", bump, { passive: true });

    bump();

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      node.removeEventListener("scroll", bump);
      window.removeEventListener("resize", bump);
    };
  }, []);

  const value = useMemo(
    () => ({
      sceneStyle,
      sceneRootRef,
      sceneVersion,
      parentSceneRootRef: parentContext?.sceneRootRef ?? null,
      parentSceneVersion: parentContext?.sceneVersion ?? 0,
    }),
    [parentContext?.sceneVersion, parentContext?.sceneRootRef, sceneStyle, sceneVersion]
  );

  return (
    <LiquidGlassSceneContext.Provider value={value}>
      {children}
    </LiquidGlassSceneContext.Provider>
  );
}

export function LiquidGlassSceneRoot({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const context = useLiquidGlassScene();
  return (
    <div
      ref={context.sceneRootRef}
      data-liquid-scene-root="true"
      aria-hidden="true"
      className={cn("pointer-events-none select-none", className)}
      style={{ ...context.sceneStyle, ...style }}
    >
      {children}
    </div>
  );
}

export function useLiquidGlassScene() {
  const context = useContext(LiquidGlassSceneContext);
  if (!context) {
    throw new Error("useLiquidGlassScene must be used inside LiquidGlassSceneProvider");
  }
  return context;
}

export function useLiquidGlassSceneStyle() {
  return useLiquidGlassScene().sceneStyle;
}

export function useSceneMetrics(elementRef: React.RefObject<HTMLElement | null>) {
  const context = useLiquidGlassScene();
  const [metrics, setMetrics] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    const scene = context.sceneRootRef.current;
    const element = elementRef.current;
    if (!scene || !element) return;

    const update = () => {
      const sceneRect = scene.getBoundingClientRect();
      const elRect = element.getBoundingClientRect();
      setMetrics({
        x: elRect.left - sceneRect.left,
        y: elRect.top - sceneRect.top,
        width: sceneRect.width,
        height: sceneRect.height,
      });
    };

    update();
  }, [context.sceneRootRef, elementRef, context.sceneVersion]);

  return metrics;
}
