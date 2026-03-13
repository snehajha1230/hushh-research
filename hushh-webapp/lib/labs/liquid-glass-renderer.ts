import type { CSSProperties } from "react";

export type LiquidGlassRendererMode = "reference" | "mirror";
export type LiquidGlassMirrorVisualState =
  | "idle"
  | "active"
  | "pressed"
  | "dragging"
  | "held"
  | "settling";

type MirrorGlassStyleOptions = {
  compact?: boolean;
  pressed?: boolean;
  state?: LiquidGlassMirrorVisualState;
};

function resolveMirrorState({ compact, pressed, state }: MirrorGlassStyleOptions) {
  const resolvedState = state ?? (pressed ? "pressed" : "idle");
  const bodyFill = compact
    ? {
        idle: 0.06,
        active: 0.07,
        pressed: 0.09,
        dragging: 0.10,
        held: 0.08,
        settling: 0.07,
      }
    : {
        idle: 0.08,
        active: 0.09,
        pressed: 0.11,
        dragging: 0.12,
        held: 0.10,
        settling: 0.09,
      };
  const edge = {
    idle: 0.18,
    active: 0.19,
    pressed: 0.22,
    dragging: 0.22,
    held: 0.2,
    settling: 0.19,
  } satisfies Record<LiquidGlassMirrorVisualState, number>;
  const shadow = {
    idle: 0.11,
    active: 0.12,
    pressed: 0.15,
    dragging: 0.16,
    held: 0.14,
    settling: 0.12,
  } satisfies Record<LiquidGlassMirrorVisualState, number>;
  const cap = compact
    ? {
        idle: 0.08,
        active: 0.10,
        pressed: 0.07,
        dragging: 0.05,
        held: 0.10,
        settling: 0.08,
      }
    : {
        idle: 0.14,
        active: 0.16,
        pressed: 0.10,
        dragging: 0.08,
        held: 0.18,
        settling: 0.12,
      };

  return {
    resolvedState,
    fillOpacity: bodyFill[resolvedState],
    edgeOpacity: edge[resolvedState],
    shadowOpacity: shadow[resolvedState],
    capOpacity: cap[resolvedState],
  };
}

export function resolveLiquidGlassStyle(
  filterId: string,
  mode: LiquidGlassRendererMode,
  base: CSSProperties = {},
  _options: MirrorGlassStyleOptions = {}
): CSSProperties {
  if (mode === "reference") {
    return {
      ...base,
      backdropFilter: `url(#${filterId})`,
      WebkitBackdropFilter: `url(#${filterId})`,
      willChange: "transform, backdrop-filter",
      isolation: "isolate",
    };
  }

  return resolveMirrorGlassContainerStyle(base);
}

export function resolveMirrorGlassContainerStyle(
  base: CSSProperties = {},
  options: MirrorGlassStyleOptions = {}
): CSSProperties {
  const { fillOpacity, edgeOpacity, shadowOpacity } = resolveMirrorState(options);
  const existingShadow = typeof base.boxShadow === "string" ? base.boxShadow : "";

  return {
    ...base,
    backgroundColor:
      typeof base.backgroundColor === "string"
        ? base.backgroundColor
        : `rgba(255, 255, 255, ${fillOpacity})`,
    border:
      typeof base.border === "string"
        ? base.border
        : `1px solid rgba(255, 255, 255, ${edgeOpacity})`,
    boxShadow: [
      existingShadow,
      `0 8px 24px rgba(0, 0, 0, ${shadowOpacity})`,
      "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
      "inset 0 -1px 0 rgba(255, 255, 255, 0.025)",
    ]
      .filter(Boolean)
      .join(", "),
    willChange: "transform",
    isolation: "isolate",
    transform:
      typeof base.transform === "string"
        ? `${base.transform} translateZ(0)`
        : "translateZ(0)",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    contain: "paint",
    backgroundClip: "padding-box",
  };
}

export function resolveMirrorHighlightStyle(options: MirrorGlassStyleOptions = {}): CSSProperties {
  const { resolvedState, capOpacity } = resolveMirrorState(options);
  const topOpacity =
    resolvedState === "dragging" || resolvedState === "pressed"
      ? 0.04
      : options.compact
        ? 0.035
        : 0.05;
  const rimOpacity =
    resolvedState === "dragging" || resolvedState === "pressed" ? 0.04 : 0.03;
  const causticOpacity =
    resolvedState === "dragging" || resolvedState === "pressed" ? 0.02 : 0.01;

  return {
    position: "absolute",
    inset: 0,
    backgroundImage: [
      `radial-gradient(68% 34% at 50% 12%, rgba(255,255,255,${capOpacity}) 0%, rgba(255,255,255,${capOpacity * 0.3}) 26%, rgba(255,255,255,0) 58%)`,
      `linear-gradient(180deg, rgba(255,255,255,${topOpacity}) 0%, rgba(255,255,255,0.03) 24%, rgba(255,255,255,0) 58%)`,
      `radial-gradient(100% 90% at 22% 12%, rgba(255,255,255,${rimOpacity}) 0%, rgba(255,255,255,0) 60%)`,
      `linear-gradient(90deg, rgba(255,255,255,${causticOpacity}) 0%, rgba(255,255,255,0.008) 18%, rgba(255,255,255,0) 42%)`,
    ].join(", "),
    mixBlendMode: "screen",
    pointerEvents: "none",
  };
}
