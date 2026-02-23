import { beforeEach, describe, expect, it, vi } from "vitest";

const loadFullBlobMock = vi.fn();
const storeMergedDomainMock = vi.fn();

vi.mock("@/lib/services/world-model-service", () => ({
  WorldModelService: {
    loadFullBlob: loadFullBlobMock,
    storeMergedDomain: storeMergedDomainMock,
  },
}));

describe("KaiProfileService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadFullBlobMock.mockResolvedValue({});
    storeMergedDomainMock.mockResolvedValue({ success: true });
  });

  it("returns default v2 profile when no stored domain exists", async () => {
    const { KaiProfileService } = await import("../../lib/services/kai-profile-service");

    const profile = await KaiProfileService.getProfile({
      userId: "user_123",
      vaultKey: "key_abc",
      vaultOwnerToken: "token_xyz",
    });

    expect(profile.schema_version).toBe(2);
    expect(profile.onboarding.completed).toBe(false);
    expect(profile.preferences.investment_horizon).toBeNull();
    expect(profile.preferences.risk_profile).toBeNull();
  });

  it("returns default profile when only legacy kai_profile exists", async () => {
    loadFullBlobMock.mockResolvedValue({
      kai_profile: {
        schema_version: 1,
        intro_seen: true,
        investment_horizon: "long_term",
        investment_style: "growth",
        updated_at: "2026-02-15T00:00:00.000Z",
      },
    });

    const { KaiProfileService } = await import("../../lib/services/kai-profile-service");
    const profile = await KaiProfileService.getProfile({
      userId: "user_123",
      vaultKey: "key_abc",
      vaultOwnerToken: "token_xyz",
    });

    expect(profile.schema_version).toBe(2);
    expect(profile.onboarding.completed).toBe(false);
    expect(profile.onboarding.skipped_preferences).toBe(false);
    expect(profile.preferences.investment_horizon).toBeNull();
    expect(profile.preferences.drawdown_response).toBeNull();
    expect(profile.preferences.volatility_preference).toBeNull();
    expect(profile.preferences.risk_profile).toBeNull();
  });

  it("computes risk score + persona on savePreferences and persists via storeMergedDomain", async () => {
    const now = new Date("2026-02-17T00:00:00.000Z");

    const { KaiProfileService } = await import("../../lib/services/kai-profile-service");
    const next = await KaiProfileService.savePreferences({
      userId: "user_123",
      vaultKey: "key_abc",
      vaultOwnerToken: "token_xyz",
      mode: "onboarding",
      now,
      updates: {
        investment_horizon: "long_term",
        drawdown_response: "buy_more",
        volatility_preference: "large",
      },
    });

    expect(next.schema_version).toBe(2);
    expect(next.preferences.risk_score).toBe(6);
    expect(next.preferences.risk_profile).toBe("aggressive");
    expect(next.preferences.risk_profile_selected_at).toBe(now.toISOString());
    expect(next.preferences.investment_horizon_selected_at).toBe(now.toISOString());
    expect(next.preferences.investment_horizon_anchor_at).toBe(now.toISOString());

    expect(storeMergedDomainMock).toHaveBeenCalledTimes(1);
    expect(storeMergedDomainMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        vaultKey: "key_abc",
        domain: "financial",
        vaultOwnerToken: "token_xyz",
        domainData: expect.objectContaining({
          schema_version: 3,
          profile: expect.objectContaining({
            schema_version: 2,
            preferences: expect.objectContaining({
              risk_profile: "aggressive",
              risk_score: 6,
            }),
          }),
        }),
        summary: expect.objectContaining({
          profile_completed: false,
          risk_profile: "aggressive",
          risk_score: 6,
        }),
      })
    );
  });

  it("keeps original horizon anchor when editing with keep_original", async () => {
    loadFullBlobMock.mockResolvedValue({
      financial: {
        profile: {
          schema_version: 2,
          onboarding: {
            completed: true,
            completed_at: "2026-02-10T00:00:00.000Z",
            skipped_preferences: false,
            version: 2,
          },
          preferences: {
            investment_horizon: "long_term",
            investment_horizon_selected_at: "2026-01-01T00:00:00.000Z",
            investment_horizon_anchor_at: "2026-01-01T00:00:00.000Z",
            drawdown_response: "stay",
            drawdown_response_selected_at: "2026-01-01T00:00:00.000Z",
            volatility_preference: "moderate",
            volatility_preference_selected_at: "2026-01-01T00:00:00.000Z",
            risk_score: 4,
            risk_profile: "balanced",
            risk_profile_selected_at: "2026-01-01T00:00:00.000Z",
          },
          updated_at: "2026-02-10T00:00:00.000Z",
        },
      },
    });

    const now = new Date("2026-02-17T00:00:00.000Z");

    const { KaiProfileService } = await import("../../lib/services/kai-profile-service");
    const next = await KaiProfileService.savePreferences({
      userId: "user_123",
      vaultKey: "key_abc",
      vaultOwnerToken: "token_xyz",
      mode: "edit",
      horizonAnchorChoice: "keep_original",
      now,
      updates: {
        investment_horizon: "short_term",
      },
    });

    expect(next.preferences.investment_horizon).toBe("short_term");
    expect(next.preferences.investment_horizon_selected_at).toBe(now.toISOString());
    expect(next.preferences.investment_horizon_anchor_at).toBe("2026-01-01T00:00:00.000Z");
    expect(next.preferences.risk_profile).toBe("conservative");
    expect(next.preferences.risk_profile_selected_at).toBe(now.toISOString());
  });
});

describe("Kai risk helpers", () => {
  it("scores answers and maps persona buckets correctly", async () => {
    const { computeRiskScore, mapRiskProfile } = await import(
      "../../lib/services/kai-profile-service"
    );

    const conservativeScore = computeRiskScore({
      investment_horizon: "short_term",
      drawdown_response: "reduce",
      volatility_preference: "small",
    });
    expect(conservativeScore).toBe(0);
    expect(mapRiskProfile(conservativeScore!)).toBe("conservative");

    const balancedScore = computeRiskScore({
      investment_horizon: "medium_term",
      drawdown_response: "stay",
      volatility_preference: "moderate",
    });
    expect(balancedScore).toBe(3);
    expect(mapRiskProfile(balancedScore!)).toBe("balanced");

    const aggressiveScore = computeRiskScore({
      investment_horizon: "long_term",
      drawdown_response: "buy_more",
      volatility_preference: "large",
    });
    expect(aggressiveScore).toBe(6);
    expect(mapRiskProfile(aggressiveScore!)).toBe("aggressive");
  });

  it("encodes horizon edit anchor semantics", async () => {
    const { resolveHorizonAnchorAt, shouldPromptForHorizonAnchor } = await import(
      "../../lib/services/kai-profile-service"
    );

    expect(
      shouldPromptForHorizonAnchor({
        mode: "onboarding",
        previousHorizon: "long_term",
        nextHorizon: "short_term",
      })
    ).toBe(false);

    expect(
      shouldPromptForHorizonAnchor({
        mode: "edit",
        previousHorizon: null,
        nextHorizon: "short_term",
      })
    ).toBe(false);

    expect(
      shouldPromptForHorizonAnchor({
        mode: "edit",
        previousHorizon: "medium_term",
        nextHorizon: "long_term",
      })
    ).toBe(true);

    expect(
      resolveHorizonAnchorAt({
        previousAnchorAt: "2026-01-01T00:00:00.000Z",
        now: "2026-02-17T00:00:00.000Z",
        choice: "keep_original",
      })
    ).toBe("2026-01-01T00:00:00.000Z");

    expect(
      resolveHorizonAnchorAt({
        previousAnchorAt: "2026-01-01T00:00:00.000Z",
        now: "2026-02-17T00:00:00.000Z",
        choice: "from_now",
      })
    ).toBe("2026-02-17T00:00:00.000Z");

    expect(
      resolveHorizonAnchorAt({
        previousAnchorAt: null,
        now: "2026-02-17T00:00:00.000Z",
        choice: "keep_original",
      })
    ).toBe("2026-02-17T00:00:00.000Z");
  });
});
