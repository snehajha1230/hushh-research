import { HushhVault } from "@/lib/capacitor";
import { decryptData } from "@/lib/vault/encrypt";
import { WorldModelService } from "@/lib/services/world-model-service";

const DOMAIN = "kai_profile";
const SCHEMA_VERSION = 1;

export interface KaiIntroProfile {
  schema_version: number;
  intro_seen: boolean;
  investment_horizon: string | null;
  investment_style: string | null;
  updated_at: string;
}

type KaiIntroPatch = Partial<
  Pick<KaiIntroProfile, "intro_seen" | "investment_horizon" | "investment_style">
>;

const createDefaultProfile = (): KaiIntroProfile => ({
  schema_version: SCHEMA_VERSION,
  intro_seen: false,
  investment_horizon: null,
  investment_style: null,
  updated_at: new Date().toISOString(),
});

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProfile(raw: unknown): KaiIntroProfile {
  const fallback = createDefaultProfile();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fallback;
  }

  const profile = raw as Record<string, unknown>;
  return {
    schema_version:
      typeof profile.schema_version === "number"
        ? profile.schema_version
        : SCHEMA_VERSION,
    intro_seen: profile.intro_seen === true,
    investment_horizon: normalizeOptionalString(profile.investment_horizon),
    investment_style: normalizeOptionalString(profile.investment_style),
    updated_at:
      typeof profile.updated_at === "string" && profile.updated_at.length > 0
        ? profile.updated_at
        : fallback.updated_at,
  };
}

function applyPatch(base: KaiIntroProfile, patch: KaiIntroPatch): KaiIntroProfile {
  const next: KaiIntroProfile = {
    ...base,
    schema_version: SCHEMA_VERSION,
    updated_at: new Date().toISOString(),
  };

  if (typeof patch.intro_seen === "boolean") {
    next.intro_seen = patch.intro_seen;
  }

  if (patch.investment_horizon !== undefined) {
    next.investment_horizon = normalizeOptionalString(patch.investment_horizon);
  }

  if (patch.investment_style !== undefined) {
    next.investment_style = normalizeOptionalString(patch.investment_style);
  }

  return next;
}

async function getFullBlob(params: {
  userId: string;
  vaultKey: string;
  vaultOwnerToken?: string;
}): Promise<Record<string, unknown>> {
  const existing = await WorldModelService.getDomainData(
    params.userId,
    DOMAIN,
    params.vaultOwnerToken
  );
  if (!existing) {
    return {};
  }

  const decrypted = await decryptData(
    {
      ciphertext: existing.ciphertext,
      iv: existing.iv,
      tag: existing.tag,
      encoding: "base64",
      algorithm: (existing.algorithm || "aes-256-gcm") as "aes-256-gcm",
    },
    params.vaultKey
  );

  const parsed = JSON.parse(decrypted);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function selectProfile(fullBlob: Record<string, unknown>): KaiIntroProfile {
  const nested = fullBlob[DOMAIN];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return normalizeProfile(nested);
  }

  return normalizeProfile(fullBlob);
}

export class KaiIntroService {
  static async getProfile(params: {
    userId: string;
    vaultKey: string;
    vaultOwnerToken?: string;
  }): Promise<KaiIntroProfile> {
    try {
      const fullBlob = await getFullBlob(params);
      return selectProfile(fullBlob);
    } catch (error) {
      console.warn("[KaiIntroService] Failed to load intro profile:", error);
      return createDefaultProfile();
    }
  }

  static async saveProfile(params: {
    userId: string;
    vaultKey: string;
    vaultOwnerToken?: string;
    patch: KaiIntroPatch;
  }): Promise<KaiIntroProfile> {
    const fullBlob: Record<string, unknown> = await getFullBlob(params).catch(
      () => ({})
    );
    const current = selectProfile(fullBlob);
    const next = applyPatch(current, params.patch);

    fullBlob[DOMAIN] = next;

    const encrypted = await HushhVault.encryptData({
      plaintext: JSON.stringify(fullBlob),
      keyHex: params.vaultKey,
    });

    await WorldModelService.storeDomainData({
      userId: params.userId,
      domain: DOMAIN,
      encryptedBlob: {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag,
        algorithm: "aes-256-gcm",
      },
      summary: {
        intro_seen: next.intro_seen,
        has_investment_horizon: Boolean(next.investment_horizon),
        has_investment_style: Boolean(next.investment_style),
        last_updated: next.updated_at,
      },
      vaultOwnerToken: params.vaultOwnerToken,
    });

    return next;
  }
}
