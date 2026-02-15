import { beforeEach, describe, expect, it } from "vitest";

import { useKaiSession } from "@/lib/stores/kai-session-store";

describe("useKaiSession busy operations", () => {
  beforeEach(() => {
    useKaiSession.getState().clear();
  });

  it("disables search when at least one busy operation is active", () => {
    const store = useKaiSession.getState();

    expect(store.isSearchDisabled).toBe(false);

    store.setBusyOperation("portfolio_optimize_stream", true);
    expect(useKaiSession.getState().isSearchDisabled).toBe(true);

    store.setBusyOperation("portfolio_optimize_stream", false);
    expect(useKaiSession.getState().isSearchDisabled).toBe(false);
  });

  it("keeps search disabled until all operations finish", () => {
    const store = useKaiSession.getState();

    store.setBusyOperation("portfolio_save", true);
    store.setBusyOperation("stock_analysis_stream", true);
    expect(useKaiSession.getState().isSearchDisabled).toBe(true);

    store.setBusyOperation("portfolio_save", false);
    expect(useKaiSession.getState().isSearchDisabled).toBe(true);

    store.setBusyOperation("stock_analysis_stream", false);
    expect(useKaiSession.getState().isSearchDisabled).toBe(false);
  });
});
