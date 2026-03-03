import { describe, expect, it } from "vitest";

import {
  normalizeApiPathToTemplate,
  resolveRouteId,
} from "@/lib/observability/route-map";

describe("observability route map", () => {
  it("maps canonical app routes to stable route IDs", () => {
    expect(resolveRouteId("/kai")).toBe("kai_home");
    expect(resolveRouteId("/kai/dashboard")).toBe("kai_dashboard");
    expect(resolveRouteId("/kai/dashboard/analysis")).toBe("kai_dashboard_legacy_redirect");
    expect(resolveRouteId("/unknown/path")).toBe("unknown");
  });

  it("normalizes known API endpoint templates", () => {
    expect(normalizeApiPathToTemplate("/api/kai/market/insights/user_123")).toBe(
      "/api/kai/market/insights/{user_id}"
    );
    expect(normalizeApiPathToTemplate("/api/kai/analyze/run/run_987/stream?cursor=0")).toBe(
      "/api/kai/analyze/run/{run_id}/stream"
    );
    expect(normalizeApiPathToTemplate("/api/vault/get?userId=test")).toBe(
      "/db/vault/get"
    );
  });

  it("redacts opaque IDs for unknown endpoints", () => {
    expect(
      normalizeApiPathToTemplate("/api/custom/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/details")
    ).toBe("/api/custom/{id}/details");
  });
});
