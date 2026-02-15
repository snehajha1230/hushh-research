import { beforeEach, describe, expect, it, vi } from "vitest";

const loadFullBlobMock = vi.fn();
const storeMergedDomainMock = vi.fn();

vi.mock("@/lib/services/world-model-service", () => ({
  WorldModelService: {
    loadFullBlob: loadFullBlobMock,
    storeMergedDomain: storeMergedDomainMock,
  },
}));

describe("KaiIntroService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadFullBlobMock.mockResolvedValue({});
    storeMergedDomainMock.mockResolvedValue({ success: true });
  });

  it("returns default profile when no stored domain exists", async () => {
    const { KaiIntroService } = await import("../../lib/services/kai-intro-service");

    const profile = await KaiIntroService.getProfile({
      userId: "user_123",
      vaultKey: "key_abc",
      vaultOwnerToken: "token_xyz",
    });

    expect(profile.intro_seen).toBe(false);
    expect(profile.investment_horizon).toBeNull();
    expect(profile.investment_style).toBeNull();
    expect(profile.schema_version).toBe(1);
  });

  it("reads nested kai_profile payload from encrypted world-model blob", async () => {
    loadFullBlobMock.mockResolvedValue({
      kai_profile: {
        schema_version: 1,
        intro_seen: true,
        investment_horizon: "long_term",
        investment_style: "growth",
        updated_at: "2026-02-15T00:00:00.000Z",
      },
    });

    const { KaiIntroService } = await import("../../lib/services/kai-intro-service");
    const profile = await KaiIntroService.getProfile({
      userId: "user_123",
      vaultKey: "key_abc",
      vaultOwnerToken: "token_xyz",
    });

    expect(profile.intro_seen).toBe(true);
    expect(profile.investment_horizon).toBe("long_term");
    expect(profile.investment_style).toBe("growth");
  });

  it("merges patch and stores summary fields under kai_profile domain", async () => {
    loadFullBlobMock.mockResolvedValue({
      kai_profile: {
        schema_version: 1,
        intro_seen: false,
        investment_horizon: null,
        investment_style: null,
        updated_at: "2026-02-14T00:00:00.000Z",
      },
    });

    const { KaiIntroService } = await import("../../lib/services/kai-intro-service");
    const result = await KaiIntroService.saveProfile({
      userId: "user_123",
      vaultKey: "key_abc",
      vaultOwnerToken: "token_xyz",
      patch: {
        intro_seen: true,
        investment_horizon: "medium_term",
      },
    });

    expect(result.intro_seen).toBe(true);
    expect(result.investment_horizon).toBe("medium_term");
    expect(result.investment_style).toBeNull();

    expect(storeMergedDomainMock).toHaveBeenCalledTimes(1);
    expect(storeMergedDomainMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        vaultKey: "key_abc",
        domain: "kai_profile",
        vaultOwnerToken: "token_xyz",
        domainData: expect.objectContaining({
          intro_seen: true,
          investment_horizon: "medium_term",
          investment_style: null,
        }),
        summary: expect.objectContaining({
          intro_seen: true,
          has_investment_horizon: true,
          has_investment_style: false,
        }),
      })
    );
  });
});
