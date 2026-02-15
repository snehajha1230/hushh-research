/**
 * ImportProgressView Component
 *
 * Real-time streaming progress UI for portfolio import.
 * Displays Gemini AI extraction progress with thinking mode support.
 *
 * Features:
 * - Animated progress bar for stream progression
 * - Real-time thought summaries from Gemini thinking mode (in StreamingAccordion)
 * - Human-readable streaming text display (transforms JSON to readable format)
 * - Character count and chunk count stats
 * - Cancel button
 * - Auto-collapsing accordions when streaming completes
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/morphy-ux";
import { StreamingAccordion } from "@/lib/morphy-ux/streaming-accordion";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/lib/morphy-ux/card";
import { Progress } from "@/components/ui/progress";
import { Button as MorphyButton } from "@/lib/morphy-ux/button";
import { X, FileChartColumn, Database, CheckCircle2 } from "lucide-react";


export type ImportStage =
  | "idle"
  | "uploading"
  | "analyzing"
  | "thinking"
  | "extracting"
  | "parsing"
  | "complete"
  | "error";

interface QualityReport {
  raw?: number;
  validated?: number;
  dropped?: number;
  reconciled?: number;
  mismatch_detected?: number;
}

interface LiveHoldingPreview {
  symbol?: string;
  name?: string;
  market_value?: number | null;
  quantity?: number | null;
  asset_type?: string;
}

export interface ImportProgressViewProps {
  /** Current processing stage */
  stage: ImportStage;
  /** Streamed text from Gemini (raw JSON being built) */
  streamedText: string;
  /** Whether actively streaming */
  isStreaming: boolean;
  /** Total characters received */
  totalChars: number;
  /** Total chunks received */
  chunkCount: number;
  /** Stream progress percentage from backend canonical payload */
  progressPct?: number;
  /** Optional status message from backend payload */
  statusMessage?: string;
  /** Array of thought summaries from Gemini thinking mode */
  thoughts?: string[];
  /** Total thought count */
  thoughtCount?: number;
  /** Quality reconciliation summary from backend parser */
  qualityReport?: QualityReport;
  /** Incremental parsed holdings preview */
  liveHoldings?: LiveHoldingPreview[];
  /** Parsed holdings count so far */
  holdingsExtracted?: number;
  /** Total holdings expected */
  holdingsTotal?: number;
  /** Error message if stage is 'error' */
  errorMessage?: string;
  /** Cancel handler */
  onCancel?: () => void;
  /** Continue from completed import to review screen */
  onContinue?: () => void;
  /** Return to dashboard after completed import */
  onBackToDashboard?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const stageMessages: Record<ImportStage, string> = {
  idle: "Ready to import",
  uploading: "Processing uploaded file...",
  analyzing: "AI analyzing document structure...",
  thinking: "AI reasoning about your portfolio...",
  extracting: "Extracting financial data...",
  parsing: "Processing extracted data...",
  complete: "Import complete!",
  error: "Import failed",
};

export function ImportProgressView({
  stage,
  streamedText,
  isStreaming,
  totalChars,
  chunkCount,
  progressPct,
  statusMessage,
  thoughts = [],
  thoughtCount = 0,
  qualityReport,
  liveHoldings = [],
  holdingsExtracted = 0,
  holdingsTotal,
  errorMessage,
  onCancel,
  onContinue,
  onBackToDashboard,
  className,
}: ImportProgressViewProps) {
  // Determine if we're in a thinking or extracting phase
  const isThinking = stage === "thinking";
  const isExtracting = stage === "extracting" || stage === "parsing";
  const isComplete = stage === "complete";
  const visibleStreamText =
    streamedText ||
    (isStreaming
      ? `${statusMessage || stageMessages[stage]}\n\nWaiting for next stream chunk...`
      : "");
  const resolvedProgress = useMemo(() => {
    if (typeof progressPct === "number" && Number.isFinite(progressPct)) {
      return Math.max(0, Math.min(100, progressPct));
    }
    switch (stage) {
      case "uploading":
        return 5;
      case "analyzing":
        return 20;
      case "thinking":
        return 45;
      case "extracting":
        return 70;
      case "parsing":
        return 90;
      case "complete":
        return 100;
      case "error":
        return 100;
      default:
        return 0;
    }
  }, [progressPct, stage]);

  // Format thoughts into a single text string for the accordion
  // Matches the [N] **Header** pattern for bold rendering
  const thoughtsText = useMemo(() => {
    if (thoughts.length === 0) {
      return isThinking ? "[1] **Analyzing portfolio structure**\nInitializing extraction engine..." : "";
    }
    return thoughts.map((t, i) => `[${i + 1}] **${t}**`).join("\n");
  }, [thoughts, isThinking]);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileChartColumn className={cn("w-5 h-5", isStreaming && "text-primary")} />
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
        {/* Stream Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Import progress</span>
            <span>{Math.round(resolvedProgress)}%</span>
          </div>
          <Progress
            value={resolvedProgress}
            className={cn("h-2", isStreaming && "transition-all")}
          />
        </div>

        {/* Status Message */}
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {statusMessage || stageMessages[stage]}
          </p>
        </div>


        {/* AI Reasoning Accordion - Shows during thinking phase, persists when complete */}
        {(isThinking || (thoughts.length > 0 && !isComplete) || (isComplete && thoughts.length > 0)) && (
          <StreamingAccordion
            id="ai-reasoning"
            title={`AI Reasoning${thoughtCount > 0 ? ` (${thoughtCount} thoughts)` : ""}`}
            text={thoughtsText}
            isStreaming={isThinking || isExtracting}
            isComplete={isComplete}
            icon={isComplete ? "brain" : "spinner"}
            className="border-primary/10"
          />
        )}



        {/* Data Extraction Stream */}
        {(isStreaming || (streamedText && !isComplete) || (isComplete && streamedText)) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-primary" />
                Live Extraction Stream
              </span>
              <span>
                {totalChars.toLocaleString()} chars • {chunkCount} chunks
              </span>
            </div>
            <StreamingAccordion
              id="data-extraction-live"
              title="Realtime Extracted Text"
              text={visibleStreamText}
              isStreaming={isStreaming}
              isComplete={isComplete}
              formatAsHuman={false}
              icon={isComplete ? "database" : "spinner"}
              iconClassName="w-6 h-6"
              maxHeight="320px"
              defaultExpanded={true}
              autoCollapseOnComplete={false}
              emptyStreamingMessage="Initializing Vertex stream..."
              bodyClassName="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed"
            />
          </div>
        )}

        {/* Parsed holdings preview while parsing */}
        {(holdingsExtracted > 0 || liveHoldings.length > 0) && (
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Extracted Holdings</span>
              <span>
                {holdingsExtracted}
                {typeof holdingsTotal === "number" && holdingsTotal > 0 ? ` / ${holdingsTotal}` : ""}
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto pr-1 space-y-1.5">
              {liveHoldings.map((holding, idx) => (
                  <div
                    key={`${holding.symbol || holding.name || "holding"}-${idx}`}
                    className="rounded-lg border border-border/40 bg-background/70 px-2.5 py-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground/90 truncate">
                          {holding.symbol || `Holding ${idx + 1}`}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {holding.name || "Security captured from statement"}
                        </p>
                      </div>
                      {holding.asset_type && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border/50 rounded px-1.5 py-0.5">
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
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {stage === "error" && errorMessage && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-500">{errorMessage}</p>
          </div>
        )}

        {/* Complete State */}
        {stage === "complete" && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                Successfully extracted portfolio data
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalChars.toLocaleString()} characters processed
              {thoughtCount > 0 && ` • ${thoughtCount} AI reasoning steps`}
            </p>
            {qualityReport && (
              <p className="text-xs text-muted-foreground mt-1">
                Validated {qualityReport.validated ?? 0}
                {qualityReport.reconciled !== undefined
                  ? ` • Reconciled ${qualityReport.reconciled}`
                  : ""}
                {qualityReport.dropped !== undefined ? ` • Dropped ${qualityReport.dropped}` : ""}
                {qualityReport.mismatch_detected !== undefined
                  ? ` • Mismatches ${qualityReport.mismatch_detected}`
                  : ""}
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
                className="mt-2 ml-2"
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
