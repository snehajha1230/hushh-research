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
  return WorldModelService.loadFullBlob({
    userId: params.userId,
    vaultKey: params.vaultKey,
    vaultOwnerToken: params.vaultOwnerToken,
  });
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

    const result = await WorldModelService.storeMergedDomain({
      userId: params.userId,
      vaultKey: params.vaultKey,
      domain: DOMAIN,
      domainData: next as unknown as Record<string, unknown>,
      summary: {
        domain_intent: "kai_profile",
        intro_seen: next.intro_seen,
        has_investment_horizon: Boolean(next.investment_horizon),
        has_investment_style: Boolean(next.investment_style),
        last_updated: next.updated_at,
      },
      vaultOwnerToken: params.vaultOwnerToken,
    });

    if (!result.success) {
      throw new Error("Failed to persist Kai intro profile");
    }

    return next;
  }
}
