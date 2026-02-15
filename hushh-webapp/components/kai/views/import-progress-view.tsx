/**
 * ImportProgressView Component
 *
 * Real-time streaming progress UI for portfolio import.
 * Displays Gemini AI extraction progress with thinking mode support.
 *
 * Features:
 * - Stage progress indicators (Upload → Analyze → Think → Extract → Complete)
 * - Real-time thought summaries from Gemini thinking mode (in StreamingAccordion)
 * - Human-readable streaming text display (transforms JSON to readable format)
 * - Character count and chunk count stats
 * - Cancel button
 * - Auto-collapsing accordions when streaming completes
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/morphy-ux";
import {
  StreamingStageIndicator,
} from "@/lib/morphy-ux";
import { StreamingAccordion } from "@/lib/morphy-ux/streaming-accordion";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/lib/morphy-ux/card";
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
  /** Array of thought summaries from Gemini thinking mode */
  thoughts?: string[];
  /** Total thought count */
  thoughtCount?: number;
  /** Quality reconciliation summary from backend parser */
  qualityReport?: QualityReport;
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

const STAGES = ["Upload", "Analyze", "Think", "Extract", "Complete"] as const;

const stageToIndex: Record<ImportStage, number> = {
  idle: -1,
  uploading: 0,
  analyzing: 1,
  thinking: 2,
  extracting: 3,
  parsing: 3,
  complete: 4,
  error: -1,
};

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
  thoughts = [],
  thoughtCount = 0,
  qualityReport,
  errorMessage,
  onCancel,
  onContinue,
  onBackToDashboard,
  className,
}: ImportProgressViewProps) {
  const currentStageIndex = stageToIndex[stage];

  // Determine if we're in a thinking or extracting phase
  const isThinking = stage === "thinking";
  const isExtracting = stage === "extracting" || stage === "parsing";
  const isComplete = stage === "complete";

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
        {/* Stage Progress */}
        <StreamingStageIndicator
          stages={[...STAGES]}
          currentStage={currentStageIndex}
          showLabels
        />

        {/* Status Message */}
        <div className="flex items-center gap-2">
          {stage !== "analyzing" && !isThinking && !isExtracting && (
            <p className="text-sm text-muted-foreground">
              {stageMessages[stage]}
            </p>
          )}
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



        {/* Data Extraction Panels - Interpreted + Raw */}
        {(isExtracting || (streamedText && !isComplete) || (isComplete && streamedText)) && (
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
              id="data-extraction-human"
              title="Interpreted Stream"
              text={streamedText}
              isStreaming={isStreaming && isExtracting}
              isComplete={isComplete}
              formatAsHuman={true}
              icon={isComplete ? "database" : "spinner"}
              iconClassName="w-6 h-6"
              maxHeight="220px"
              defaultExpanded={true}
            />
            <StreamingAccordion
              id="data-extraction-raw"
              title="Raw Stream"
              text={streamedText}
              isStreaming={isStreaming && isExtracting}
              isComplete={isComplete}
              formatAsHuman={false}
              icon={isComplete ? "database" : "spinner"}
              iconClassName="w-6 h-6"
              maxHeight="180px"
            />
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
