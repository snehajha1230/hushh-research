/**
 * Portfolio Data Normalizer
 * =========================
 *
 * When portfolio data is saved to the World Model, it uses the
 * ReviewPortfolioData field names (from portfolio-review-view.tsx).
 * When the Dashboard and Manage pages load it back, they expect the
 * DashboardPortfolioData field names (from dashboard-view.tsx).
 *
 * This module bridges the gap by detecting which shape the data is in
 * and normalising to the Dashboard shape. It is safe to call on data
 * that is already in Dashboard format — the function is idempotent.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

function parseMaybeNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const text = String(value).trim();
  if (!text || ["n/a", "na", "null", "none", "--", "-"].includes(text.toLowerCase())) {
    return undefined;
  }
  const negative = text.startsWith("(") && text.endsWith(")");
  const sanitized = text.replace(/[,$\s]/g, "").replace(/%/g, "").replace(/[()]/g, "");
  const parsed = Number(negative ? `-${sanitized}` : sanitized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstPresent(obj: AnyObj, keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return undefined;
}

/**
 * Normalize a stored portfolio blob into Dashboard-compatible format.
 *
 * Handles Review-format field names (holder_name, brokerage, cash_pct,
 * dividends_taxable, interest_income, total_income, short_term_gain,
 * long_term_gain, net_realized) and maps them to Dashboard names
 * (account_holder, brokerage_name, cash_percent, dividends, interest,
 * total, short_term, long_term, total).
 *
 * Also computes missing `unrealized_gain_loss_pct` on holdings.
 */
export function normalizeStoredPortfolio(raw: AnyObj): AnyObj {
  if (!raw || typeof raw !== "object") return raw;

  // If it's already Dashboard-format, return as-is (detect via brokerage_name)
  const ai = raw.account_info;

  const normalizedAccountInfo = ai
    ? {
        account_number: ai.account_number,
        account_type: ai.account_type,
        // Map Review → Dashboard, keep Dashboard field if already present
        brokerage_name: ai.brokerage_name || ai.brokerage || undefined,
        institution_name: ai.institution_name || ai.brokerage || undefined,
        account_holder: ai.account_holder || ai.holder_name || undefined,
        statement_period: ai.statement_period,
        statement_period_start: ai.statement_period_start,
        statement_period_end: ai.statement_period_end,
      }
    : undefined;

  const as = raw.account_summary;
  const normalizedAccountSummary = as
    ? {
        beginning_value: as.beginning_value,
        ending_value: as.ending_value ?? raw.total_value ?? 0,
        change_in_value: as.change_in_value,
        cash_balance: as.cash_balance,
        equities_value: as.equities_value,
        total_change: as.total_change,
        net_deposits_withdrawals: as.net_deposits_withdrawals,
        investment_gain_loss: as.investment_gain_loss,
      }
    : undefined;

  const aa = raw.asset_allocation;
  // asset_allocation can be an object or an array (category breakdown)
  const normalizedAssetAllocation = aa
    ? Array.isArray(aa)
      ? aa
      : {
          cash_percent: aa.cash_percent ?? aa.cash_pct ?? aa.cash_value,
          cash_pct: aa.cash_pct ?? aa.cash_percent,
          equities_percent: aa.equities_percent ?? aa.equities_pct ?? aa.equities_value,
          equities_pct: aa.equities_pct ?? aa.equities_percent,
          bonds_percent: aa.bonds_percent ?? aa.bonds_pct ?? aa.bonds_value,
          bonds_pct: aa.bonds_pct ?? aa.bonds_percent,
          other_percent: aa.other_percent,
        }
    : undefined;

  const is = raw.income_summary;
  const normalizedIncomeSummary = is
    ? {
        dividends: is.dividends ?? is.dividends_taxable,
        interest: is.interest ?? is.interest_income,
        total: is.total ?? is.total_income,
        // Keep additional fields that may be present
        ...(is.qualified_dividends !== undefined
          ? { qualified_dividends: is.qualified_dividends }
          : {}),
        ...(is.non_qualified_dividends !== undefined
          ? { non_qualified_dividends: is.non_qualified_dividends }
          : {}),
      }
    : undefined;

  const rgl = raw.realized_gain_loss;
  const normalizedRealizedGainLoss = rgl
    ? {
        short_term: rgl.short_term ?? rgl.short_term_gain,
        short_term_gain: rgl.short_term_gain ?? rgl.short_term,
        long_term: rgl.long_term ?? rgl.long_term_gain,
        long_term_gain: rgl.long_term_gain ?? rgl.long_term,
        total: rgl.total ?? rgl.net_realized,
        net_realized: rgl.net_realized ?? rgl.total,
        // Keep additional fields
        ...(rgl.short_term_loss !== undefined
          ? { short_term_loss: rgl.short_term_loss }
          : {}),
        ...(rgl.long_term_loss !== undefined
          ? { long_term_loss: rgl.long_term_loss }
          : {}),
      }
    : undefined;

  // Normalize holdings: map aliases and compute missing unrealized_gain_loss_pct
  const sourceHoldings = Array.isArray(raw.holdings)
    ? raw.holdings
    : Array.isArray(raw.detailed_holdings)
      ? raw.detailed_holdings
      : [];
  const normalizedHoldings = normalizeHoldings(sourceHoldings);

  return {
    ...raw,
    account_info: normalizedAccountInfo,
    account_summary: normalizedAccountSummary,
    asset_allocation: normalizedAssetAllocation,
    income_summary: normalizedIncomeSummary,
    realized_gain_loss: normalizedRealizedGainLoss,
    holdings: normalizedHoldings,
    // Keep both keys aligned so downstream pages can consume either.
    detailed_holdings: normalizedHoldings,
    transactions: raw.transactions || [],
    activity_and_transactions: raw.activity_and_transactions,
    historical_values: raw.historical_values,
    cash_flow: raw.cash_flow,
    cash_management: raw.cash_management,
    cash_balance: raw.cash_balance,
    total_value: raw.total_value,
    ytd_metrics: raw.ytd_metrics,
    ytd_summary: raw.ytd_summary,
    total_fees: raw.total_fees,
    projections_and_mrd: raw.projections_and_mrd,
    legal_and_disclosures: raw.legal_and_disclosures,
  };
}

/**
 * Ensure each holding has canonical fields and derived unrealized percentage.
 */
function normalizeHoldings(holdings: AnyObj[] | undefined): AnyObj[] | undefined {
  if (!holdings || !Array.isArray(holdings)) return holdings;

  return holdings.map((h) => {
    const symbol = String(
      firstPresent(h, ["symbol", "symbol_cusip", "ticker", "cusip", "security_id", "security"]) || ""
    ).trim();
    const name = String(
      firstPresent(h, ["name", "description", "security_name", "holding_name"]) || "Unknown"
    ).trim();
    const quantity = parseMaybeNumber(firstPresent(h, ["quantity", "shares", "units", "qty"])) ?? 0;
    const price =
      parseMaybeNumber(
        firstPresent(h, ["price", "price_per_unit", "last_price", "unit_price", "current_price"])
      ) ?? 0;
    const marketValue =
      parseMaybeNumber(
        firstPresent(h, ["market_value", "current_value", "marketValue", "value", "position_value"])
      ) ?? 0;
    const costBasis = parseMaybeNumber(firstPresent(h, ["cost_basis", "book_value", "cost", "total_cost"]));
    const unrealized = parseMaybeNumber(
      firstPresent(h, ["unrealized_gain_loss", "gain_loss", "unrealized_pnl", "pnl"])
    );
    let unrealizedPct = parseMaybeNumber(
      firstPresent(h, ["unrealized_gain_loss_pct", "gain_loss_pct", "unrealized_return_pct", "return_pct"])
    );

    if (unrealizedPct === undefined && unrealized !== undefined) {
      let basis: number | undefined;
      if (costBasis !== undefined && Math.abs(costBasis) > 1e-6) {
        basis = costBasis;
      } else if (marketValue !== 0) {
        basis = marketValue - unrealized;
      }
      if (basis !== undefined && Math.abs(basis) > 1e-6) {
        unrealizedPct = (unrealized / basis) * 100;
      }
    }

    return {
      ...h,
      symbol,
      name,
      quantity,
      price,
      market_value: marketValue,
      cost_basis: costBasis,
      unrealized_gain_loss: unrealized,
      unrealized_gain_loss_pct: unrealizedPct,
      asset_type:
        (firstPresent(h, ["asset_type", "asset_class", "security_type", "type"]) as string | undefined) ??
        h.asset_type,
    };
  });
}
