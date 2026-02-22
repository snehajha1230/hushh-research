/**
 * PortfolioReviewView Component
 *
 * Review screen for verifying and editing parsed portfolio data before saving.
 * Displayed after PDF parsing completes, before data is saved to world model.
 *
 * Features:
 * - Account info display (editable)
 * - Summary section with key metrics
 * - Holdings list with inline editing
 * - Asset allocation breakdown
 * - Income summary (if available)
 * - Save to Vault button (encrypts and stores to world model)
 * - Re-import button to try again
 */

"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Pencil,
  Trash2,
  Undo2,
  Plus,
  Save,
  RefreshCw,
  Loader2,
  AlertCircle,
  Building2,
  TrendingUp,
  TrendingDown,
  PieChart,
  Wallet,
} from "lucide-react";
import { morphyToast as toast } from "@/lib/morphy-ux/morphy";
import { cn } from "@/lib/utils";
import { Icon } from "@/lib/morphy-ux/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";


import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { WorldModelService } from "@/lib/services/world-model-service";
import { CacheSyncService } from "@/lib/cache/cache-sync-service";
import type { PortfolioData as CachedPortfolioData } from "@/lib/cache/cache-context";
import { useKaiSession } from "@/lib/stores/kai-session-store";
import { Button as MorphyButton } from "@/lib/morphy-ux/button";
import { useAuth } from "@/hooks/use-auth";
import { useVault } from "@/lib/vault/vault-context";
import { VaultService } from "@/lib/services/vault-service";
import { VaultFlow } from "@/components/vault/vault-flow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card as MorphyCard, 
  CardContent, 
  CardHeader, 
  CardTitle,
} from "@/lib/morphy-ux/card";
import { scrollAppToTop } from "@/lib/navigation/use-scroll-reset";




// =============================================================================
// TYPES
// =============================================================================

export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  market_value: number;
  cost_basis?: number;
  unrealized_gain_loss?: number;
  unrealized_gain_loss_pct?: number;
  asset_type?: string;
  pending_delete?: boolean;
}

export interface AccountInfo {
  holder_name?: string;
  account_number?: string;
  account_type?: string;
  brokerage?: string;
  statement_period_start?: string;
  statement_period_end?: string;
}

export interface AccountSummary {
  beginning_value?: number;
  ending_value?: number;
  cash_balance?: number;
  equities_value?: number;
  change_in_value?: number;
  total_change?: number;
  net_deposits_withdrawals?: number;
  net_deposits_period?: number;
  net_deposits_ytd?: number;
  investment_gain_loss?: number;
  total_income_period?: number;
  total_income_ytd?: number;
  total_fees?: number;
}

export interface AssetAllocation {
  cash_pct?: number;
  cash_value?: number;
  equities_pct?: number;
  equities_value?: number;
  bonds_pct?: number;
  bonds_value?: number;
}

export interface IncomeSummary {
  dividends_taxable?: number;
  interest_income?: number;
  total_income?: number;
}

export interface RealizedGainLoss {
  short_term_gain?: number;
  long_term_gain?: number;
  net_realized?: number;
}

export interface QualityReport {
  raw?: number;
  validated?: number;
  aggregated?: number;
  dropped?: number;
  reconciled?: number;
  mismatch_detected?: number;
  parse_repair_applied?: boolean;
  parse_repair_actions?: string[];
  parse_fallback?: boolean;
  average_confidence?: number;
}

export interface PortfolioData {
  account_info?: AccountInfo;
  account_summary?: AccountSummary;
  asset_allocation?: AssetAllocation;
  holdings?: Holding[];
  income_summary?: IncomeSummary;
  realized_gain_loss?: RealizedGainLoss;
  transactions?: Array<Record<string, unknown>>;
  activity_and_transactions?: Array<Record<string, unknown>>;
  cash_flow?: Record<string, unknown>;
  cash_management?: Record<string, unknown>;
  projections_and_mrd?: Record<string, unknown>;
  legal_and_disclosures?: string[];
  quality_report?: QualityReport;
  domain_intent?: {
    primary: string;
    source: string;
    captured_sections: readonly string[];
    updated_at: string;
  };
  parse_fallback?: boolean;
  cash_balance?: number;
  total_value?: number;
}

export interface PortfolioReviewViewProps {
  /** Parsed portfolio data from Gemini */
  portfolioData: PortfolioData;
  /** User ID for saving */
  userId: string;
  /** Vault key for encryption */
  vaultKey: string;
  /** VAULT_OWNER token for authentication (required on native) */
  vaultOwnerToken?: string;
  /** Callback when save completes successfully */
  onSaveComplete: (data: PortfolioData) => void | Promise<void>;
  /** Callback to re-import */
  onReimport: () => void;
  /** Callback to go back */
  onBack?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function _formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return "0.00%";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function deriveRiskBucket(holdings: Holding[]): string {
  if (!holdings || holdings.length === 0) return "unknown";

  const totalValue = holdings.reduce(
    (sum, h) => sum + (h.market_value || 0),
    0
  );
  if (totalValue === 0) return "unknown";

  // Sort by value descending
  const sorted = [...holdings].sort(
    (a, b) => (b.market_value || 0) - (a.market_value || 0)
  );
  const topHoldingPct =
    sorted.length > 0 ? ((sorted[0]?.market_value || 0) / totalValue) * 100 : 0;

  if (topHoldingPct > 30) return "aggressive";
  if (topHoldingPct > 15) return "moderate";
  return "conservative";
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const normalized = trimmed
      .replace(/[,$\s]/g, "")
      .replace(/%/g, "")
      .replace(/[()]/g, "");
    if (!normalized) return undefined;
    const asNumber = Number(trimmed.startsWith("(") && trimmed.endsWith(")") ? `-${normalized}` : normalized);
    return Number.isFinite(asNumber) ? asNumber : undefined;
  }
  return undefined;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function compactRecord<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => {
      if (entryValue === undefined || entryValue === null) return false;
      if (typeof entryValue === "string" && entryValue.trim().length === 0) return false;
      return true;
    })
  ) as Partial<T>;
}

function hasRecordValues(value: Record<string, unknown> | undefined): boolean {
  return Boolean(value) && Object.keys(value as Record<string, unknown>).length > 0;
}

function sanitizeAccountSummary(value: unknown): AccountSummary {
  const record = toRecord(value);
  if (!record) return {};
  return compactRecord({
    beginning_value: toFiniteNumber(record.beginning_value),
    ending_value: toFiniteNumber(record.ending_value),
    cash_balance: toFiniteNumber(record.cash_balance),
    equities_value: toFiniteNumber(record.equities_value),
    change_in_value: toFiniteNumber(record.change_in_value),
    total_change: toFiniteNumber(record.total_change),
    net_deposits_withdrawals: toFiniteNumber(record.net_deposits_withdrawals),
    net_deposits_period: toFiniteNumber(record.net_deposits_period),
    net_deposits_ytd: toFiniteNumber(record.net_deposits_ytd),
    investment_gain_loss: toFiniteNumber(record.investment_gain_loss),
    total_income_period: toFiniteNumber(record.total_income_period),
    total_income_ytd: toFiniteNumber(record.total_income_ytd),
    total_fees: toFiniteNumber(record.total_fees),
  } satisfies AccountSummary) as AccountSummary;
}

function sanitizeAssetAllocation(value: unknown): AssetAllocation {
  const record = toRecord(value);
  if (!record) return {};
  return compactRecord({
    cash_pct: toFiniteNumber(record.cash_pct),
    cash_value: toFiniteNumber(record.cash_value),
    equities_pct: toFiniteNumber(record.equities_pct),
    equities_value: toFiniteNumber(record.equities_value),
    bonds_pct: toFiniteNumber(record.bonds_pct),
    bonds_value: toFiniteNumber(record.bonds_value),
  } satisfies AssetAllocation) as AssetAllocation;
}

function hasSummaryValues(summary: AccountSummary): boolean {
  return (
    summary.beginning_value !== undefined ||
    summary.ending_value !== undefined ||
    summary.cash_balance !== undefined ||
    summary.equities_value !== undefined ||
    summary.change_in_value !== undefined ||
    summary.total_change !== undefined ||
    summary.net_deposits_withdrawals !== undefined ||
    summary.net_deposits_period !== undefined ||
    summary.net_deposits_ytd !== undefined ||
    summary.investment_gain_loss !== undefined ||
    summary.total_income_period !== undefined ||
    summary.total_income_ytd !== undefined ||
    summary.total_fees !== undefined
  );
}

function hasAllocationValues(allocation: AssetAllocation): boolean {
  return (
    allocation.cash_pct !== undefined ||
    allocation.cash_value !== undefined ||
    allocation.equities_pct !== undefined ||
    allocation.equities_value !== undefined ||
    allocation.bonds_pct !== undefined ||
    allocation.bonds_value !== undefined
  );
}

function mergeAccountSummary(primary: AccountSummary, fallback: AccountSummary): AccountSummary {
  return compactRecord({
    beginning_value: primary.beginning_value ?? fallback.beginning_value,
    ending_value: primary.ending_value ?? fallback.ending_value,
    cash_balance: primary.cash_balance ?? fallback.cash_balance,
    equities_value: primary.equities_value ?? fallback.equities_value,
    change_in_value: primary.change_in_value ?? fallback.change_in_value,
    total_change: primary.total_change ?? fallback.total_change,
    net_deposits_withdrawals:
      primary.net_deposits_withdrawals ?? fallback.net_deposits_withdrawals,
    net_deposits_period: primary.net_deposits_period ?? fallback.net_deposits_period,
    net_deposits_ytd: primary.net_deposits_ytd ?? fallback.net_deposits_ytd,
    investment_gain_loss: primary.investment_gain_loss ?? fallback.investment_gain_loss,
    total_income_period: primary.total_income_period ?? fallback.total_income_period,
    total_income_ytd: primary.total_income_ytd ?? fallback.total_income_ytd,
    total_fees: primary.total_fees ?? fallback.total_fees,
  } satisfies AccountSummary) as AccountSummary;
}

function _mergeAssetAllocation(primary: AssetAllocation, fallback: AssetAllocation): AssetAllocation {
  return compactRecord({
    cash_pct: primary.cash_pct ?? fallback.cash_pct,
    cash_value: primary.cash_value ?? fallback.cash_value,
    equities_pct: primary.equities_pct ?? fallback.equities_pct,
    equities_value: primary.equities_value ?? fallback.equities_value,
    bonds_pct: primary.bonds_pct ?? fallback.bonds_pct,
    bonds_value: primary.bonds_value ?? fallback.bonds_value,
  } satisfies AssetAllocation) as AssetAllocation;
}

function pickRicherAccountSummary(left: AccountSummary, right: AccountSummary): AccountSummary {
  return Object.keys(right).length > Object.keys(left).length ? right : left;
}

function pickRicherAssetAllocation(left: AssetAllocation, right: AssetAllocation): AssetAllocation {
  return Object.keys(right).length > Object.keys(left).length ? right : left;
}

function isCashLikeHolding(holding: Holding): boolean {
  const symbol = String(holding.symbol || "").trim().toUpperCase();
  const name = String(holding.name || "").trim().toLowerCase();
  const assetType = String(holding.asset_type || "").trim().toLowerCase();
  if (symbol === "CASH" || symbol === "SWEEP" || symbol === "MMF") return true;
  if (name.includes("cash") || name.includes("sweep")) return true;
  if (assetType.includes("cash") || assetType.includes("money market")) return true;
  return false;
}

function deriveCashFromHoldings(holdings: Holding[]): number | undefined {
  const total = holdings.reduce((sum, holding) => {
    if (!isCashLikeHolding(holding)) return sum;
    return sum + (toFiniteNumber(holding.market_value) ?? 0);
  }, 0);
  return total > 0 ? total : undefined;
}

function statementCompletenessScore(statement: Record<string, unknown>): number {
  const summary = sanitizeAccountSummary(statement.account_summary);
  const allocation = sanitizeAssetAllocation(statement.asset_allocation);
  const holdings = Array.isArray(statement.holdings) ? statement.holdings.length : 0;
  const quality = toRecord(statement.quality_report);
  const validated = toFiniteNumber(quality?.validated);

  const summaryCount = Object.keys(summary).length;
  const allocationCount = Object.keys(allocation).length;
  return summaryCount * 6 + allocationCount * 4 + Math.min(holdings, 25) + (validated ?? 0) / 10;
}

function pickBestStatementSnapshot(statements: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(statements) || statements.length === 0) return undefined;
  const candidates = statements
    .map((entry) => toRecord(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry));
  if (candidates.length === 0) return undefined;
  candidates.sort((left, right) => statementCompletenessScore(right) - statementCompletenessScore(left));
  return candidates[0];
}

const SpinningLoader = (props: any) => (
  <Loader2 {...props} className={cn(props.className, "animate-spin")} />
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PortfolioReviewView({
  portfolioData: initialData,
  userId,
  vaultKey,
  vaultOwnerToken,
  onSaveComplete,
  onReimport,
  onBack: _onBack,
  className,
}: PortfolioReviewViewProps) {
  const { user } = useAuth();
  const { vaultKey: ctxVaultKey, vaultOwnerToken: ctxVaultOwnerToken } = useVault();
  const effectiveVaultKey = ctxVaultKey ?? vaultKey;
  const effectiveVaultOwnerToken = ctxVaultOwnerToken ?? vaultOwnerToken;

  // Editable state
  const [accountInfo, setAccountInfo] = useState<AccountInfo>(
    initialData.account_info || {}
  );
  const [accountSummary, _setAccountSummary] = useState<AccountSummary>(
    initialData.account_summary || {}
  );
  const [holdings, setHoldings] = useState<Holding[]>(
    (initialData.holdings || []).map((holding) => ({
      ...holding,
      pending_delete: Boolean(holding.pending_delete),
    }))
  );
  const [assetAllocation] = useState<AssetAllocation>(
    initialData.asset_allocation || {}
  );
  const [incomeSummary] = useState<IncomeSummary>(
    initialData.income_summary || {}
  );
  const [realizedGainLoss] = useState<RealizedGainLoss>(
    initialData.realized_gain_loss || {}
  );

  const [isSaving, setIsSaving] = useState(false);
  const setBusyOperation = useKaiSession((s) => s.setBusyOperation);
  const [vaultDialogOpen, setVaultDialogOpen] = useState(false);
  const [pendingVaultSave, setPendingVaultSave] = useState(false);
  const [hasVault, setHasVault] = useState<boolean | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const createdVaultCopyRef = useRef(false);
  const createdVaultModeRef = useRef<string | null>(null);
  const continuationInFlightRef = useRef(false);
  const [editingHoldingIndex, setEditingHoldingIndex] = useState<number | null>(
    null
  );

  // Computed values
  // Scroll to top on mount to ensure clean view framing after progress view
  useEffect(() => {
    scrollAppToTop("auto");
  }, []);

  const serializeEditableState = useCallback(
    (nextAccountInfo: AccountInfo, nextHoldings: Holding[]): string =>
      JSON.stringify({
        accountInfo: nextAccountInfo,
        holdings: nextHoldings.map((holding) => ({
          ...holding,
          pending_delete: Boolean(holding.pending_delete),
        })),
      }),
    []
  );

  const baselineSnapshotRef = useRef(
    serializeEditableState(
      initialData.account_info || {},
      (initialData.holdings || []).map((holding) => ({
        ...holding,
        pending_delete: Boolean(holding.pending_delete),
      }))
    )
  );

  const currentEditableSnapshot = useMemo(
    () => serializeEditableState(accountInfo, holdings),
    [accountInfo, holdings, serializeEditableState]
  );

  useEffect(() => {
    setHasUnsavedChanges(currentEditableSnapshot !== baselineSnapshotRef.current);
  }, [currentEditableSnapshot]);

  useEffect(() => {
    setBusyOperation("portfolio_save", isSaving);
    return () => {
      setBusyOperation("portfolio_save", false);
    };
  }, [isSaving, setBusyOperation]);

  useEffect(() => {
    setBusyOperation("portfolio_review_active", true);
    return () => {
      setBusyOperation("portfolio_review_active", false);
    };
  }, [setBusyOperation]);

  useEffect(() => {
    setBusyOperation("portfolio_review_dirty", hasUnsavedChanges);
    return () => {
      setBusyOperation("portfolio_review_dirty", false);
    };
  }, [hasUnsavedChanges, setBusyOperation]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges || isSaving) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges, isSaving]);

  useEffect(() => {
    let cancelled = false;

    async function loadVaultState() {
      if (!user) return;
      try {
        const next = await VaultService.checkVault(userId);
        if (!cancelled) setHasVault(next);
      } catch (error) {
        console.warn("[PortfolioReviewView] Failed to check vault existence:", error);
        if (!cancelled) setHasVault(null);
      }
    }

    void loadVaultState();

    return () => {
      cancelled = true;
    };
  }, [user, userId]);

  useEffect(() => {
    if (!pendingVaultSave) return;
    if (!effectiveVaultKey || !effectiveVaultOwnerToken) return;
    if (continuationInFlightRef.current) return;

    setPendingVaultSave(false);
    continuationInFlightRef.current = true;
    void handleSave().finally(() => {
      continuationInFlightRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVaultSave, effectiveVaultKey, effectiveVaultOwnerToken]);

  const activeHoldings = useMemo(
    () => holdings.filter((holding) => !holding.pending_delete),
    [holdings]
  );
  const pendingDeleteCount = holdings.length - activeHoldings.length;

  const totalValue = useMemo(() => {
    const holdingsTotal = activeHoldings.reduce((sum, h) => sum + (h.market_value || 0), 0);
    const cashBalance = initialData.cash_balance || accountSummary.cash_balance || 0;
    const derivedTotal = holdingsTotal + cashBalance;
    if (holdingsTotal > 0) {
      return derivedTotal;
    }
    return accountSummary.ending_value || derivedTotal || holdingsTotal;
  }, [activeHoldings, accountSummary.cash_balance, accountSummary.ending_value, initialData.cash_balance]);

  const totalUnrealizedGainLoss = useMemo(() => {
    return activeHoldings.reduce(
      (sum, h) => sum + (h.unrealized_gain_loss || 0),
      0
    );
  }, [activeHoldings]);

  const riskBucket = useMemo(() => deriveRiskBucket(activeHoldings), [activeHoldings]);

  // Handlers
  const handleDeleteHolding = useCallback((index: number) => {
    let action: "mark" | "restore" | null = null;
    setHoldings((prev) =>
      prev.map((holding, i) => {
        if (i !== index) return holding;
        const currentlyPendingDelete = Boolean(holding.pending_delete);
        action = currentlyPendingDelete ? "restore" : "mark";
        return {
          ...holding,
          pending_delete: !currentlyPendingDelete,
        };
      })
    );
    if (action === "restore") {
      toast.info("Holding restored");
      return;
    }
    toast.info("Holding marked for removal");
  }, []);

  const handleUpdateHolding = useCallback(
    (index: number, field: keyof Holding, value: string | number) => {
      setHoldings((prev) =>
        prev.map((h, i) => {
          if (i !== index) return h;
          const updated = { ...h, [field]: value };
          // Recalculate market value if quantity or price changed
          if (field === "quantity" || field === "price") {
            updated.market_value =
              (updated.quantity || 0) * (updated.price || 0);
          }
          return updated;
        })
      );
    },
    []
  );

  const handleAddHolding = useCallback(() => {
    const newHolding: Holding = {
      symbol: "",
      name: "New Holding",
      quantity: 0,
      price: 0,
      market_value: 0,
      pending_delete: false,
    };
    setHoldings((prev) => [...prev, newHolding]);
    setEditingHoldingIndex(holdings.length);
    toast.info("New holding added - please fill in the details");
  }, [holdings.length]);

  const handleSave = async () => {
    if (!userId) return;

    // If vault existence isn't resolved yet, resolve it on-demand so copy/flow is correct.
    let resolvedHasVault = hasVault;
    if (resolvedHasVault === null) {
      try {
        resolvedHasVault = await VaultService.checkVault(userId);
        setHasVault(resolvedHasVault);
      } catch (error) {
        console.warn(
          "[PortfolioReviewView] Failed to resolve vault existence on save:",
          error
        );
        resolvedHasVault = null;
      }
    }

    if (!effectiveVaultKey || !effectiveVaultOwnerToken) {
      createdVaultCopyRef.current = resolvedHasVault === false;
      createdVaultModeRef.current = null;
      setPendingVaultSave(true);
      setVaultDialogOpen(true);
      toast.info(
        resolvedHasVault === false
          ? "Create your vault to save your portfolio."
          : "Unlock your vault to save your portfolio."
      );
      return;
    }

    setIsSaving(true);

    try {
      const capturedSections = [
        "account_info",
        "account_summary",
        "asset_allocation",
        "holdings",
        "income_summary",
        "realized_gain_loss",
        "cash_flow",
        "cash_management",
        "projections_and_mrd",
        "legal_and_disclosures",
      ] as const;

      const holdingsSummary = activeHoldings.map((h) => ({
        symbol: h.symbol,
        name: h.name,
        quantity: h.quantity,
        current_price: h.price,
      }));

      const nowIso = new Date().toISOString();
      const fullBlob = await WorldModelService.loadFullBlob({
        userId,
        vaultKey: effectiveVaultKey,
        vaultOwnerToken: effectiveVaultOwnerToken,
      }).catch(() => ({} as Record<string, unknown>));
      const existingFinancialValue = fullBlob.financial;
      const existingFinancial =
        existingFinancialValue &&
        typeof existingFinancialValue === "object" &&
        !Array.isArray(existingFinancialValue)
          ? ({ ...(existingFinancialValue as Record<string, unknown>) } as Record<string, unknown>)
          : {};

      const existingPortfolioCandidate = toRecord(existingFinancial.portfolio) ?? existingFinancial;

      const parsedAccountSummary = sanitizeAccountSummary(accountSummary);
      const parsedAssetAllocation = sanitizeAssetAllocation(assetAllocation);
      const parsedCashBalance =
        toFiniteNumber(initialData.cash_balance) ?? parsedAccountSummary.cash_balance;
      const holdingsTotal = activeHoldings.reduce(
        (sum, holding) => sum + (toFiniteNumber(holding.market_value) ?? 0),
        0
      );
      const derivedCashBalance = deriveCashFromHoldings(activeHoldings);

      // 3. Append structured statement snapshot (no raw PDF bytes).
      const existingDocsValue = existingFinancial.documents;
      const existingDocsSource =
        existingDocsValue &&
        typeof existingDocsValue === "object" &&
        !Array.isArray(existingDocsValue)
          ? (existingDocsValue as Record<string, unknown>)
          : {};
      const existingDocs = { ...existingDocsSource };
      const existingStatementsValue = existingDocs.statements;
      const existingStatements = Array.isArray(existingStatementsValue)
        ? [...existingStatementsValue]
        : [];
      const bestStatementSnapshot = pickBestStatementSnapshot(existingStatements);

      const existingPortfolioSummary = sanitizeAccountSummary(
        existingPortfolioCandidate.account_summary
      );
      const existingStatementSummary = sanitizeAccountSummary(
        bestStatementSnapshot?.account_summary
      );
      const fallbackAccountSummary = pickRicherAccountSummary(
        existingPortfolioSummary,
        existingStatementSummary
      );

      const existingPortfolioAllocation = sanitizeAssetAllocation(
        existingPortfolioCandidate.asset_allocation
      );
      const existingStatementAllocation = sanitizeAssetAllocation(
        bestStatementSnapshot?.asset_allocation
      );
      const fallbackAssetAllocation = pickRicherAssetAllocation(
        existingPortfolioAllocation,
        existingStatementAllocation
      );

      const fallbackCashBalance =
        toFiniteNumber(existingPortfolioCandidate.cash_balance) ??
        existingPortfolioSummary.cash_balance ??
        toFiniteNumber(bestStatementSnapshot?.cash_balance) ??
        existingStatementSummary.cash_balance;
      const fallbackTotalValue =
        toFiniteNumber(existingPortfolioCandidate.total_value) ??
        existingPortfolioSummary.ending_value ??
        toFiniteNumber(bestStatementSnapshot?.total_value) ??
        existingStatementSummary.ending_value;

      const statementTotalValue =
        toFiniteNumber(initialData.total_value) ??
        parsedAccountSummary.ending_value ??
        (holdingsTotal > 0
          ? holdingsTotal + (parsedCashBalance ?? derivedCashBalance ?? 0)
          : undefined);
      const resolvedCashBalance = parsedCashBalance ?? derivedCashBalance ?? fallbackCashBalance;
      const resolvedTotalValue =
        statementTotalValue ??
        (holdingsTotal > 0 ? holdingsTotal + (resolvedCashBalance ?? 0) : undefined) ??
        fallbackTotalValue ??
        0;

      const resolvedAccountSummary = compactRecord({
        ...mergeAccountSummary(parsedAccountSummary, fallbackAccountSummary),
        ending_value: resolvedTotalValue > 0 ? resolvedTotalValue : undefined,
        cash_balance: resolvedCashBalance,
      } satisfies AccountSummary) as AccountSummary;
      const resolvedAssetAllocation = hasAllocationValues(parsedAssetAllocation)
        ? parsedAssetAllocation
        : fallbackAssetAllocation;

      const sparseSections: string[] = [];
      if (!hasSummaryValues(parsedAccountSummary)) sparseSections.push("account_summary");
      if (!hasAllocationValues(parsedAssetAllocation)) sparseSections.push("asset_allocation");
      if (!initialData.account_info || Object.keys(initialData.account_info).length === 0) {
        sparseSections.push("account_info");
      }

      const parseFallback =
        initialData.parse_fallback === true ||
        initialData.quality_report?.parse_fallback === true;

      const normalizedAccountInfo = compactRecord({
        holder_name: accountInfo.holder_name,
        account_number: accountInfo.account_number,
        account_type: accountInfo.account_type,
        brokerage: accountInfo.brokerage,
        statement_period_start: accountInfo.statement_period_start,
        statement_period_end: accountInfo.statement_period_end,
      } satisfies AccountInfo) as AccountInfo;
      const normalizedIncomeSummary = compactRecord({
        dividends_taxable: incomeSummary.dividends_taxable,
        interest_income: incomeSummary.interest_income,
        total_income: incomeSummary.total_income,
      } satisfies IncomeSummary) as IncomeSummary;
      const normalizedRealizedGainLoss = compactRecord({
        short_term_gain: realizedGainLoss.short_term_gain,
        long_term_gain: realizedGainLoss.long_term_gain,
        net_realized: realizedGainLoss.net_realized,
      } satisfies RealizedGainLoss) as RealizedGainLoss;

      const portfolioToSave: PortfolioData = {
        account_info: hasRecordValues(normalizedAccountInfo as Record<string, unknown>)
          ? normalizedAccountInfo
          : undefined,
        account_summary: hasSummaryValues(resolvedAccountSummary)
          ? resolvedAccountSummary
          : undefined,
        asset_allocation: hasAllocationValues(resolvedAssetAllocation)
          ? resolvedAssetAllocation
          : undefined,
        holdings: activeHoldings,
        income_summary: hasRecordValues(normalizedIncomeSummary as Record<string, unknown>)
          ? normalizedIncomeSummary
          : undefined,
        realized_gain_loss: hasRecordValues(
          normalizedRealizedGainLoss as Record<string, unknown>
        )
          ? normalizedRealizedGainLoss
          : undefined,
        cash_balance: resolvedCashBalance,
        total_value: resolvedTotalValue,
        parse_fallback: parseFallback,
        domain_intent: {
          primary: "financial",
          source: "kai_import_llm",
          captured_sections: capturedSections,
          updated_at: nowIso,
        },
      };

      const snapshotId = `stmt_${Date.now()}`;
      const statementAccountSummary = compactRecord({
        ...parsedAccountSummary,
        ending_value: statementTotalValue ?? parsedAccountSummary.ending_value,
        cash_balance: parsedCashBalance ?? derivedCashBalance,
      } satisfies AccountSummary) as AccountSummary;

      const snapshot = {
        id: snapshotId,
        imported_at: nowIso,
        domain_intent: {
          primary: "financial",
          secondary: "documents",
          source: "kai_import_llm",
          updated_at: nowIso,
        },
        source: {
          brokerage: accountInfo.brokerage || null,
          statement_period_start: accountInfo.statement_period_start || null,
          statement_period_end: accountInfo.statement_period_end || null,
          account_type: accountInfo.account_type || null,
        },
        account_info: portfolioToSave.account_info || null,
        account_summary: hasSummaryValues(statementAccountSummary)
          ? statementAccountSummary
          : null,
        holdings: portfolioToSave.holdings || [],
        transactions:
          initialData.transactions ||
          initialData.activity_and_transactions ||
          [],
        asset_allocation: hasAllocationValues(parsedAssetAllocation)
          ? parsedAssetAllocation
          : null,
        income_summary: portfolioToSave.income_summary || null,
        realized_gain_loss: portfolioToSave.realized_gain_loss || null,
        cash_flow: initialData.cash_flow || null,
        cash_management: initialData.cash_management || null,
        projections_and_mrd: initialData.projections_and_mrd || null,
        legal_and_disclosures: initialData.legal_and_disclosures || [],
        quality_report: initialData.quality_report || null,
        parse_context: {
          parse_fallback: parseFallback,
          sparse_sections: sparseSections,
          fallback_merge_applied: sparseSections.length > 0,
        },
      };
      existingStatements.unshift(snapshot);

      const nextDocsDomain = {
        schema_version: 1,
        statements: existingStatements.slice(0, 25),
        domain_intent: {
          primary: "financial",
          secondary: "documents",
          source: "kai_import_llm",
          captured_sections: capturedSections,
          updated_at: nowIso,
        },
      };

      const lastQuality = initialData.quality_report;
      const lastQualityScore =
        typeof lastQuality?.validated === "number" &&
        typeof lastQuality?.raw === "number" &&
        lastQuality.raw > 0
          ? Number((lastQuality.validated / lastQuality.raw).toFixed(4))
          : undefined;
      const bestSnapshotSource = toRecord(bestStatementSnapshot?.source);
      const bestSnapshotStatementEnd =
        typeof bestSnapshotSource?.statement_period_end === "string"
          ? bestSnapshotSource.statement_period_end
          : undefined;
      const bestSnapshotBrokerage =
        typeof bestSnapshotSource?.brokerage === "string"
          ? bestSnapshotSource.brokerage
          : undefined;
      const existingDocsStatementEnd =
        typeof existingDocs.last_statement_end === "string"
          ? (existingDocs.last_statement_end as string)
          : undefined;
      const existingDocsBrokerage =
        typeof existingDocs.last_brokerage === "string"
          ? (existingDocs.last_brokerage as string)
          : undefined;

      const docsSummary: Record<string, unknown> = {
        documents_count: nextDocsDomain.statements.length,
        last_statement_end:
          accountInfo.statement_period_end ||
          bestSnapshotStatementEnd ||
          existingDocsStatementEnd ||
          null,
        last_brokerage:
          accountInfo.brokerage || bestSnapshotBrokerage || existingDocsBrokerage || null,
        parse_fallback_last_import: parseFallback,
        sparse_sections_last_import: sparseSections,
        last_updated: nowIso,
      };
      if (lastQualityScore !== undefined) {
        docsSummary.last_quality_score = lastQualityScore;
      }

      const canonicalPortfolio = {
        ...portfolioToSave,
        domain_intent: {
          primary: "financial",
          secondary: "portfolio",
          source: "kai_import_llm",
          captured_sections: capturedSections,
          updated_at: nowIso,
        },
      };

      const nextFinancialDomain = {
        ...existingFinancial,
        // Keep compatibility fields while transitioning all readers to `financial.portfolio`.
        ...portfolioToSave,
        schema_version: 3,
        domain_intent: {
          primary: "financial",
          source: "domain_registry_prepopulate",
          contract_version: 1,
          updated_at: nowIso,
        },
        portfolio: canonicalPortfolio,
        documents: nextDocsDomain,
        updated_at: nowIso,
      };

      const financialSummary = {
        intent_source: "kai_import_llm",
        holdings_count: activeHoldings.length,
        holdings: holdingsSummary,
        portfolio_risk_bucket: riskBucket,
        risk_bucket: riskBucket,
        has_income_data: !!incomeSummary.total_income,
        has_realized_gains: !!realizedGainLoss.net_realized,
        parse_fallback_last_import: parseFallback,
        sparse_sections_last_import: sparseSections,
        domain_contract_version: 1,
        intent_map: [
          "portfolio",
          "profile",
          "documents",
          "analysis_history",
          "runtime",
          "analysis.decisions",
        ],
        ...docsSummary,
        last_updated: nowIso,
      };

      // 4. Store canonical financial domain with full-blob merge semantics.
      const financialResult = await WorldModelService.storeMergedDomain({
        userId,
        vaultKey: effectiveVaultKey,
        domain: "financial",
        domainData: nextFinancialDomain as unknown as Record<string, unknown>,
        summary: financialSummary,
        vaultOwnerToken: effectiveVaultOwnerToken,
      });

      if (!financialResult.success) {
        throw new Error("Backend returned failure on store");
      }

      // 5. Prime/invalidate deterministic cache entries for all financial reads.
      CacheSyncService.onPortfolioUpserted(
        userId,
        portfolioToSave as unknown as CachedPortfolioData
      );

      // 6. Verify the save by reading back
      try {
        const readBack = await WorldModelService.getDomainData(
          userId,
          "financial",
          effectiveVaultOwnerToken
        );
        if (!readBack) {
          console.warn("[PortfolioReview] Read-back verification failed: no data returned");
        }
      } catch (verifyErr) {
        console.warn("[PortfolioReview] Read-back verification error:", verifyErr);
      }

      if (createdVaultCopyRef.current) {
        if (createdVaultModeRef.current === "generated_default_native_biometric" || createdVaultModeRef.current === "generated_default_web_prf") {
          toast.success("Vault created with secure default key. Portfolio saved securely.");
        } else {
          toast.success("Vault created. Portfolio saved securely.");
        }
      } else {
        toast.success("Portfolio saved securely.");
      }
      baselineSnapshotRef.current = serializeEditableState(accountInfo, holdings);
      setHasUnsavedChanges(false);
      await Promise.resolve(onSaveComplete(portfolioToSave));
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save portfolio");
    } finally {
      setIsSaving(false);
      createdVaultCopyRef.current = false;
      createdVaultModeRef.current = null;
    }
  };

  const confirmDiscardChanges = useCallback((): boolean => {
    if (!hasUnsavedChanges || isSaving) return true;
    return window.confirm(
      "You have unsaved portfolio changes. Leaving now will discard them."
    );
  }, [hasUnsavedChanges, isSaving]);

  const handleReimportAttempt = useCallback(() => {
    if (!confirmDiscardChanges()) return;
    onReimport();
  }, [confirmDiscardChanges, onReimport]);

  return (
    <div className={cn("relative w-full", className)}>


      <div className="w-full max-w-lg lg:max-w-6xl mx-auto space-y-8 pb-56 px-4 md:px-6 transition-all duration-500 ease-in-out">



      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="px-1">
	            <h1 className="text-xl font-bold tracking-tight">Review Portfolio</h1>
	            <p className="text-sm text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] sm:max-w-none">
	              {hasVault === false
	                ? "Review your portfolio, then create your vault to save it."
	                : "Verify before saving to vault"}
	            </p>
	          </div>
	        </div>
        <MorphyButton 
          variant="muted" 
          size="default" 
          onClick={handleReimportAttempt}
          className="shrink-0"
          icon={{ 
            icon: RefreshCw
          }}
        >
          <span className="hidden sm:inline ml-2 font-bold">Re-import</span>
          <span className="sm:hidden font-bold">Retry</span>
        </MorphyButton>


      </div>



      <div className="lg:grid lg:grid-cols-12 lg:gap-10 lg:items-start">
        {/* Left Column / Mobile Top: Summary & Info */}
        <div className="lg:col-span-5 space-y-8">
          {/* Summary Card - Redesigned for bigger numbers */}
          <MorphyCard variant="none" className="overflow-hidden border-none shadow-xl">
            <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20" />
            <CardContent className="relative pt-8 px-6 pb-8 space-y-8">

              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                  Total Portfolio Value
                </p>
                <p className="text-4xl sm:text-5xl font-black tracking-tight bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent px-2 break-all">
                  {formatCurrency(totalValue)}
                </p>

                {totalUnrealizedGainLoss !== 0 && (
                  <div className="flex justify-center mt-3">
                    <Badge
                      className={cn(
                        "font-bold py-1 px-3",
                        totalUnrealizedGainLoss >= 0
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20"
                      )}
                    >
                      {totalUnrealizedGainLoss >= 0 ? (
                        <Icon icon={TrendingUp} size={12} className="mr-1.5" />
                      ) : (
                        <Icon icon={TrendingDown} size={12} className="mr-1.5" />
                      )}
                      {formatCurrency(totalUnrealizedGainLoss)} unrealized
                    </Badge>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 pt-6 border-t border-primary/10">
                <div className="min-w-0 text-center sm:text-left sm:pl-4">
                  <p className="text-2xl font-black">{activeHoldings.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assets</p>
                </div>
                <div className="min-w-0 flex flex-col items-center justify-center">
                  <Badge
                    variant={
                      riskBucket === "conservative"
                        ? "secondary"
                        : riskBucket === "moderate"
                          ? "default"
                          : "destructive"
                    }
                    className="font-black text-[10px] uppercase tracking-widest px-2"
                  >
                    {riskBucket}
                  </Badge>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-2">Portfolio Risk</p>
                </div>
                <div className="min-w-0 text-center sm:text-right sm:pr-4">
                  <p className="text-2xl font-black break-all">
                    {formatCurrency(initialData.cash_balance || accountSummary.cash_balance || 0)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cash</p>
                </div>
              </div>

            </CardContent>
          </MorphyCard>


      {/* Account & Meta Accordions */}
      <Accordion type="multiple" defaultValue={["account", "income"]} className="w-full space-y-4">

        <AccordionItem value="account" className="border-b-0 bg-card rounded-2xl border px-5">
          <AccordionTrigger className="text-base font-bold py-5 hover:no-underline">


            <div className="flex items-center gap-2">
              <Icon icon={Building2} size="sm" />
              Account Information
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <Label className="text-xs">Account Holder</Label>
                <Input
                  value={accountInfo.holder_name || ""}
                  onChange={(e) =>
                    setAccountInfo((prev) => ({
                      ...prev,
                      holder_name: e.target.value,
                    }))
                  }
                  placeholder="Name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Account Number</Label>
                <Input
                  value={accountInfo.account_number || ""}
                  onChange={(e) =>
                    setAccountInfo((prev) => ({
                      ...prev,
                      account_number: e.target.value,
                    }))
                  }
                  placeholder="XXX-XXXX"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Brokerage</Label>
                <Input
                  value={accountInfo.brokerage || ""}
                  onChange={(e) =>
                    setAccountInfo((prev) => ({
                      ...prev,
                      brokerage: e.target.value,
                    }))
                  }
                  placeholder="Brokerage name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Account Type</Label>
                <Input
                  value={accountInfo.account_type || ""}
                  onChange={(e) =>
                    setAccountInfo((prev) => ({
                      ...prev,
                      account_type: e.target.value,
                    }))
                  }
                  placeholder="Individual, IRA, etc."
                  className="mt-1"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Asset Allocation */}
        {(assetAllocation.cash_pct || assetAllocation.equities_pct) && (
        <AccordionItem value="allocation" className="border-b-0 bg-card rounded-2xl border px-5">
            <AccordionTrigger className="text-base font-bold py-5 hover:no-underline">


              <div className="flex items-center gap-2">
                <Icon icon={PieChart} size="sm" />
                Asset Allocation
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {assetAllocation.cash_pct !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Cash</span>
                    <div className="text-right">
                      <span className="font-medium">
                        {assetAllocation.cash_pct?.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground text-sm ml-2">
                        {formatCurrency(assetAllocation.cash_value)}
                      </span>
                    </div>
                  </div>
                )}
                {assetAllocation.equities_pct !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Equities</span>
                    <div className="text-right">
                      <span className="font-medium">
                        {assetAllocation.equities_pct?.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground text-sm ml-2">
                        {formatCurrency(assetAllocation.equities_value)}
                      </span>
                    </div>
                  </div>
                )}
                {assetAllocation.bonds_pct !== undefined &&
                  assetAllocation.bonds_pct > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Bonds</span>
                      <div className="text-right">
                        <span className="font-medium">
                          {assetAllocation.bonds_pct?.toFixed(1)}%
                        </span>
                        <span className="text-muted-foreground text-sm ml-2">
                          {formatCurrency(assetAllocation.bonds_value)}
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Income Summary */}
        {incomeSummary.total_income !== undefined && (
        <AccordionItem value="income" className="border-b-0 bg-card rounded-2xl border px-5">
            <AccordionTrigger className="text-base font-bold py-5 hover:no-underline">


              <div className="flex items-center gap-2">
                <Icon icon={Wallet} size="sm" />
                Income Summary
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {incomeSummary.dividends_taxable !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-sm">Dividends</span>
                    <span className="font-medium">
                      {formatCurrency(incomeSummary.dividends_taxable)}
                    </span>
                  </div>
                )}
                {incomeSummary.interest_income !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-sm">Interest</span>
                    <span className="font-medium">
                      {formatCurrency(incomeSummary.interest_income)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-medium">Total Income</span>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(incomeSummary.total_income)}
                  </span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
        </div>

        {/* Right Column / Mobile Bottom: Holdings */}
        <div className="lg:col-span-7 mt-8 lg:mt-0">
          <MorphyCard variant="none" className="h-full border-none shadow-xl bg-card">
            <CardHeader className="pb-4 px-6 pt-6 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-widest text-foreground">
                    Holdings ({holdings.length})
                    {pendingDeleteCount > 0 ? (
                      <span className="ml-2 text-[11px] font-semibold text-muted-foreground">
                        {pendingDeleteCount} pending remove
                      </span>
                    ) : null}
                  </CardTitle>
                </div>
                <MorphyButton 
                  variant="muted" 
                  size="sm" 
                  onClick={handleAddHolding}
                  icon={{ icon: Plus }}
                >
                  <span className="ml-2">Add</span>
                </MorphyButton>
              </div>

            </CardHeader>

            <CardContent className="space-y-4 px-6 pt-6">

          {holdings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon
                icon={AlertCircle}
                size={32}
                className="mx-auto mb-2 opacity-50"
              />
              <p>No holdings found</p>
              <p className="text-sm">Click "Add" to add holdings manually</p>
            </div>
          ) : (
            holdings.map((holding, index) => (
              <div
                key={`${holding.symbol}-${index}`}
                className={cn(
                  "p-3 rounded-lg border transition-colors",
                  holding.pending_delete && "opacity-60 border-dashed border-muted-foreground/40 bg-muted/40",
                  editingHoldingIndex === index
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                {editingHoldingIndex === index ? (
                  // Edit mode
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Symbol</Label>
                        <Input
                          value={holding.symbol}
                          onChange={(e) =>
                            handleUpdateHolding(
                              index,
                              "symbol",
                              e.target.value.toUpperCase()
                            )
                          }
                          placeholder="AAPL"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={holding.name}
                          onChange={(e) =>
                            handleUpdateHolding(index, "name", e.target.value)
                          }
                          placeholder="Apple Inc."
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          value={holding.quantity}
                          onChange={(e) =>
                            handleUpdateHolding(
                              index,
                              "quantity",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Price</Label>
                        <Input
                          type="number"
                          value={holding.price}
                          onChange={(e) =>
                            handleUpdateHolding(
                              index,
                              "price",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Market Value</Label>
                        <Input
                          value={formatCurrency(holding.market_value)}
                          disabled
                          className="mt-1 bg-muted"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <MorphyButton
                        variant="muted"
                        size="sm"
                        onClick={() => setEditingHoldingIndex(null)}
                      >
                        Done
                      </MorphyButton>
                    </div>
                  </div>
                ) : (
                  // View mode - ADJUSTED FOR MOBILE
                  <div className="flex items-center justify-between gap-4">

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span
                          className={cn(
                            "font-bold text-base",
                            holding.pending_delete && "line-through text-muted-foreground"
                          )}
                        >
                          {holding.symbol || "—"}
                        </span>
                        <span
                          className={cn(
                            "text-xs text-muted-foreground truncate block",
                            holding.pending_delete && "line-through"
                          )}
                        >
                          {holding.name}
                        </span>
                        {holding.pending_delete && (
                          <Badge variant="secondary" className="text-[10px] mt-1">
                            Pending removal
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] sm:text-xs">
                        <span className="text-muted-foreground whitespace-nowrap">
                          {holding.quantity} sh
                        </span>
                        <span className="text-muted-foreground whitespace-nowrap">
                          @ {formatCurrency(holding.price)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">
                        {formatCurrency(holding.market_value)}
                      </p>
                      {holding.unrealized_gain_loss !== undefined && (
                        <p
                          className={cn(
                            "text-[10px] font-medium",
                            (holding.unrealized_gain_loss || 0) >= 0
                              ? "text-emerald-600"
                              : "text-red-500"
                          )}
                        >
                          {holding.unrealized_gain_loss >= 0 ? "+" : ""}
                          {formatCurrency(holding.unrealized_gain_loss)}
                          {holding.unrealized_gain_loss_pct !== undefined && (
                            <span className="ml-1">
                              ({_formatPercent(holding.unrealized_gain_loss_pct)})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-auto border-l border-primary/10 pl-3">
                      <div className="flex flex-col items-center gap-1">
                        <MorphyButton
                          variant="muted"
                          size="icon"
                          className={cn(
                            "h-10 w-10 text-muted-foreground hover:text-primary transition-all duration-300 rounded-xl",
                            holding.pending_delete && "pointer-events-none opacity-50"
                          )}
                          onClick={() => setEditingHoldingIndex(index)}
                          aria-label={`Edit ${holding.symbol || `holding ${index + 1}`}`}
                        >
                          <Icon icon={Pencil} size="sm" />
                        </MorphyButton>
                        <Kbd className="text-[8px] px-1 h-3.5">EDIT</Kbd>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <MorphyButton
                          variant="muted"
                          size="icon"
                          className={cn(
                            "h-10 w-10 transition-all duration-300 rounded-xl",
                            holding.pending_delete
                              ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50"
                              : "text-red-400 hover:text-red-500 hover:bg-red-50"
                          )}
                          onClick={() => handleDeleteHolding(index)}
                          aria-label={
                            holding.pending_delete
                              ? `Undo remove ${holding.symbol || `holding ${index + 1}`}`
                              : `Remove ${holding.symbol || `holding ${index + 1}`}`
                          }
                        >
                          <Icon icon={holding.pending_delete ? Undo2 : Trash2} size="sm" />
                        </MorphyButton>
                        <Kbd className="text-[8px] px-1 h-3.5">
                          {holding.pending_delete ? "UNDO" : "DEL"}
                        </Kbd>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </MorphyCard>
    </div>
  </div>

  </div>

  {/* Save Button - Refined Floating Action */}
  {/* Save Button - Refined Floating Action with Safe Area Support */}
	  <div className="fixed left-0 right-0 bottom-[var(--app-bottom-inset)] px-10 sm:px-16 pb-2 z-[145] pointer-events-none">
	    <div className="max-w-xs mx-auto pointer-events-auto">
	      <MorphyButton
	        variant="morphy"
	        effect="fill"
	        size="default"
	        className="w-full font-black shadow-xl border-none"
	        onClick={() => {
	          createdVaultCopyRef.current = hasVault === false;
	          void handleSave();
	        }}
	        disabled={isSaving || activeHoldings.length === 0}
	        icon={{ 
	          icon: isSaving ? SpinningLoader : Save,
	          gradient: false 
	        }}
	        loading={isSaving}
	      >
	        {isSaving
	          ? "Saving..."
	          : hasVault === false
	          ? "Create vault"
	          : "Save to vault"}
	      </MorphyButton>
	    </div>
	  </div>

      {/* Vault Dialog (create/unlock) */}
      {user && (
        <Dialog
          open={vaultDialogOpen}
          onOpenChange={(open) => {
            if (isSaving) return;
            setVaultDialogOpen(open);
            if (!open) setPendingVaultSave(false);
          }}
        >
          <DialogContent className="sm:max-w-md p-0 border-none bg-transparent shadow-none">
            <DialogTitle className="sr-only">
              {hasVault === false
                ? "Create vault to save portfolio"
                : "Unlock vault to save portfolio"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Create or unlock your vault to securely save this portfolio to your world model.
            </DialogDescription>
            <VaultFlow
              user={user}
              enableGeneratedDefault={hasVault === false}
              onSuccess={(meta) => {
                createdVaultModeRef.current = meta?.mode ?? null;
                setVaultDialogOpen(false);
                if (
                  effectiveVaultKey &&
                  effectiveVaultOwnerToken &&
                  !continuationInFlightRef.current
                ) {
                  continuationInFlightRef.current = true;
                  void handleSave().finally(() => {
                    continuationInFlightRef.current = false;
                  });
                  return;
                }
                setPendingVaultSave(true);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
	</div>
	  );
}
