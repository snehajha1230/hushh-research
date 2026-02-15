import { beforeEach, describe, expect, it, vi } from "vitest";

const getDomainDataMock = vi.fn();
const storeDomainDataMock = vi.fn();
const decryptDataMock = vi.fn();
const encryptDataMock = vi.fn();

vi.mock("@/lib/services/world-model-service", () => ({
  WorldModelService: {
    getDomainData: getDomainDataMock,
    storeDomainData: storeDomainDataMock,
  },
}));

vi.mock("@/lib/vault/encrypt", () => ({
  decryptData: decryptDataMock,
}));

vi.mock("@/lib/capacitor", () => ({
  HushhVault: {
    encryptData: encryptDataMock,
  },
}));

describe("KaiIntroService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDomainDataMock.mockResolvedValue(null);
    storeDomainDataMock.mockResolvedValue({ success: true });
    decryptDataMock.mockResolvedValue("{}");
    encryptDataMock.mockResolvedValue({
      ciphertext: "cipher",
      iv: "iv",
      tag: "tag",
    });
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
    getDomainDataMock.mockResolvedValue({
      ciphertext: "existing_cipher",
      iv: "existing_iv",
      tag: "existing_tag",
      algorithm: "aes-256-gcm",
    });
    decryptDataMock.mockResolvedValue(
      JSON.stringify({
        kai_profile: {
          schema_version: 1,
          intro_seen: true,
          investment_horizon: "long_term",
          investment_style: "growth",
          updated_at: "2026-02-15T00:00:00.000Z",
        },
      })
    );

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
    getDomainDataMock.mockResolvedValue({
      ciphertext: "existing_cipher",
      iv: "existing_iv",
      tag: "existing_tag",
      algorithm: "aes-256-gcm",
    });
    decryptDataMock.mockResolvedValue(
      JSON.stringify({
        kai_profile: {
          schema_version: 1,
          intro_seen: false,
          investment_horizon: null,
          investment_style: null,
          updated_at: "2026-02-14T00:00:00.000Z",
        },
      })
    );

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

    expect(storeDomainDataMock).toHaveBeenCalledTimes(1);
    expect(storeDomainDataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        domain: "kai_profile",
        vaultOwnerToken: "token_xyz",
        summary: expect.objectContaining({
          intro_seen: true,
          has_investment_horizon: true,
          has_investment_style: false,
        }),
      })
    );
  });
});
