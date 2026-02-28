/**
 * ImportProgressView Component
 *
 * Real-time streaming progress UI for portfolio import.
 * Consolidated into two stream panels:
 * 1. Raw AI Stream
 * 2. Realtime Holdings Detected
 */

"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/morphy-ux";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { Progress } from "@/components/ui/progress";
import { Button as MorphyButton } from "@/lib/morphy-ux/button";
import { CheckCircle2, ChevronDown, ChevronUp, FileChartColumn, X } from "lucide-react";
import { Icon } from "@/lib/morphy-ux/ui";
import { useSmoothStreamProgress } from "@/lib/morphy-ux/hooks/use-smooth-stream-progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type ImportStage =
  | "idle"
  | "uploading"
  | "indexing"
  | "scanning"
  | "thinking"
  | "extracting"
  | "normalizing"
  | "validating"
  | "complete"
  | "error";

interface LiveHoldingPreview {
  symbol?: string;
  name?: string;
  market_value?: number | null;
  quantity?: number | null;
  asset_type?: string;
}

export interface ImportProgressViewProps {
  stage: ImportStage;
  isStreaming: boolean;
  progressPct?: number;
  statusMessage?: string;
  stageTrail?: string[];
  thoughts?: string[];
  rawStreamLines?: string[];
  thoughtCount?: number;
  liveHoldings?: LiveHoldingPreview[];
  holdingsExtracted?: number;
  holdingsTotal?: number;
  errorMessage?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  onContinue?: () => void;
  onBackToDashboard?: () => void;
  className?: string;
}

const stageMessages: Record<ImportStage, string> = {
  idle: "Ready to import",
  uploading: "Processing uploaded file...",
  indexing: "Indexing document...",
  scanning: "Scanning pages and sections...",
  thinking: "AI reasoning about your portfolio...",
  extracting: "Extracting financial data...",
  normalizing: "Normalizing extracted data...",
  validating: "Validating extracted holdings...",
  complete: "Import complete!",
  error: "Import failed",
};

function normalizeStreamLine(rawLine: string): string {
  return String(rawLine || "")
    .replace(/```(?:json)?/gi, " ")
    .replace(/```/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function streamLineKey(line: string): string {
  const normalized = normalizeStreamLine(line);
  const match = normalized.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) return normalized.toLowerCase();
  const tag = (match[1] || "").trim().toUpperCase();
  const message = (match[2] || "").trim().toLowerCase();
  return `[${tag}] ${message}`;
}

function splitTaggedLine(line: string): { tag?: string; message: string } {
  const normalized = normalizeStreamLine(line);
  const match = normalized.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) return { message: normalized };
  const tag = (match[1] || "").trim();
  const message = (match[2] || "").trim();
  return { tag: tag || undefined, message: message || normalized };
}

function renderBoldMarkdown(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const source = String(text || "");
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push(source.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={`strong-${match.index}`} className="font-semibold text-foreground">
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < source.length) {
    parts.push(source.slice(lastIndex));
  }
  return parts.length > 0 ? <>{parts}</> : source;
}

export function ImportProgressView({
  stage,
  isStreaming,
  progressPct,
  statusMessage,
  stageTrail = [],
  thoughts = [],
  rawStreamLines = [],
  thoughtCount = 0,
  liveHoldings = [],
  holdingsExtracted = 0,
  holdingsTotal,
  errorMessage,
  onCancel,
  onRetry,
  onContinue,
  onBackToDashboard,
  className,
}: ImportProgressViewProps) {
  const [rawExpanded, setRawExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 768;
  });
  const [holdingsExpanded, setHoldingsExpanded] = useState(true);
  const [stickRawToBottom, setStickRawToBottom] = useState(true);
  const rawStreamRef = useRef<HTMLDivElement | null>(null);

  const hasMeasuredProgress = useMemo(
    () => typeof progressPct === "number" && Number.isFinite(progressPct) && progressPct > 0,
    [progressPct]
  );

  const resolvedProgress = useMemo(() => {
    if (hasMeasuredProgress) return Math.max(0, Math.min(100, progressPct as number));
    if (stage === "complete" || stage === "error") return 100;
    return 0;
  }, [hasMeasuredProgress, progressPct, stage]);

  const smoothProgress = useSmoothStreamProgress(resolvedProgress);

  const fallbackRawLines = useMemo(() => {
    const lines = stageTrail.length > 0 ? stageTrail : [statusMessage || stageMessages[stage]];
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const line of lines) {
      const next = normalizeStreamLine(line);
      if (!next) continue;
      const key = streamLineKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(next);
    }
    if (normalized.length === 0 && thoughts.length > 0) {
      for (const thought of thoughts) {
        const next = normalizeStreamLine(`[THINKING/GENERAL] ${thought}`);
        if (!next) continue;
        const key = streamLineKey(next);
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push(next);
      }
    }
    return normalized;
  }, [stageTrail, statusMessage, stage, thoughts]);

  const effectiveRawLines = useMemo(() => {
    if (rawStreamLines.length > 0) {
      return rawStreamLines
        .map((line) => normalizeStreamLine(line))
        .filter(Boolean);
    }
    return fallbackRawLines;
  }, [rawStreamLines, fallbackRawLines]);

  useEffect(() => {
    if (!rawExpanded || !stickRawToBottom) return;
    const element = rawStreamRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [effectiveRawLines, rawExpanded, stickRawToBottom]);

  const handleRawScroll = () => {
    const element = rawStreamRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setStickRawToBottom(distanceFromBottom <= 24);
  };

  const holdingsCount = holdingsExtracted || liveHoldings.length;
  const rawCountBadge = effectiveRawLines.length || thoughtCount;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon icon={FileChartColumn} size="md" className={cn(isStreaming && "text-primary")} />
            <CardTitle className="text-lg">Importing Portfolio</CardTitle>
          </div>
          {onCancel && stage !== "complete" && (
            <MorphyButton
              variant="muted"
              size="sm"
              onClick={onCancel}
              className="h-8 rounded-lg"
              icon={{ icon: X }}
            >
              Back to Dashboard
            </MorphyButton>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Import progress</span>
            <span>
              {hasMeasuredProgress || stage === "complete" || stage === "error"
                ? `${Math.round(smoothProgress)}%`
                : "Tracking stages"}
            </span>
          </div>
          {hasMeasuredProgress || stage === "complete" || stage === "error" ? (
            <Progress
              value={smoothProgress}
              className={cn("h-2", isStreaming && "transition-all")}
            />
          ) : (
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-1/3 rounded-full bg-primary/70 animate-pulse" />
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {statusMessage || stageMessages[stage]}
        </p>

        <Collapsible open={rawExpanded} onOpenChange={setRawExpanded}>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="mb-2 flex w-full items-center justify-between text-left text-xs text-muted-foreground"
              >
                <span>Raw AI Stream</span>
                <span className="inline-flex items-center gap-1">
                  {rawCountBadge}
                  {rawExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div
                ref={rawStreamRef}
                onScroll={handleRawScroll}
                className="max-h-80 space-y-1.5 overflow-y-auto rounded-lg border border-border/40 bg-background/70 px-3 py-2"
              >
                {effectiveRawLines.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Raw stream will appear as the import pipeline emits events.
                  </p>
                ) : (
                  effectiveRawLines.map((line, index) => {
                    const { tag, message } = splitTaggedLine(line);
                    return (
                      <p
                        key={`${index}-${streamLineKey(line)}`}
                        className="text-xs leading-relaxed text-foreground/90 break-words whitespace-pre-wrap"
                      >
                        {tag ? (
                          <span className="mr-1.5 inline-flex rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {tag}
                          </span>
                        ) : null}
                        {renderBoldMarkdown(message)}
                      </p>
                    );
                  })
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        <Collapsible open={holdingsExpanded} onOpenChange={setHoldingsExpanded}>
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="mb-2 flex w-full items-center justify-between text-left text-xs text-muted-foreground"
              >
                <span>Realtime Holdings Detected</span>
                <span className="inline-flex items-center gap-1">
                  {holdingsCount}
                  {typeof holdingsTotal === "number" && holdingsTotal > 0 ? `/${holdingsTotal}` : ""}
                  {holdingsExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {liveHoldings.length === 0 ? (
                  <div className="rounded-lg border border-border/40 bg-background/70 px-2.5 py-2 text-xs text-muted-foreground">
                    No holdings detected yet. They will appear here during parsing.
                  </div>
                ) : (
                  liveHoldings.map((holding, idx) => (
                    <div
                      key={`${holding.symbol || holding.name || "holding"}-${idx}`}
                      className="rounded-lg border border-border/40 bg-background/70 px-2.5 py-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground/90">
                            {holding.symbol || `Holding ${idx + 1}`}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {holding.name || "Security captured from statement"}
                          </p>
                        </div>
                        {holding.asset_type && (
                          <span className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {holding.asset_type}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          Qty:{" "}
                          {typeof holding.quantity === "number"
                            ? holding.quantity.toLocaleString()
                            : "—"}
                        </span>
                        <span>
                          Value:{" "}
                          {typeof holding.market_value === "number"
                            ? `$${holding.market_value.toLocaleString()}`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {stage === "error" && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              {errorMessage || statusMessage || "Import failed while processing the statement."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {onRetry && (
                <MorphyButton variant="gradient" size="sm" onClick={onRetry}>
                  Retry Import
                </MorphyButton>
              )}
              {onCancel && (
                <MorphyButton variant="muted" size="sm" onClick={onCancel}>
                  Back
                </MorphyButton>
              )}
            </div>
          </div>
        )}

        {stage === "complete" && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2">
              <Icon icon={CheckCircle2} size="md" className="text-emerald-500" />
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Successfully extracted portfolio data
              </p>
            </div>
            {holdingsExtracted > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Final holdings extracted: {holdingsExtracted}
                {typeof holdingsTotal === "number" && holdingsTotal > 0 ? ` / ${holdingsTotal}` : ""}
              </p>
            )}
            {onContinue && (
              <MorphyButton
                variant="gradient"
                size="sm"
                className="mt-3"
                onClick={onContinue}
              >
                Review Extracted Portfolio
              </MorphyButton>
            )}
            {onBackToDashboard && (
              <MorphyButton
                variant="muted"
                size="sm"
                className="ml-2 mt-2"
                onClick={onBackToDashboard}
              >
                Back to Dashboard
              </MorphyButton>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
