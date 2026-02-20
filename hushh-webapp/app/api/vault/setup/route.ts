import { NextRequest, NextResponse } from "next/server";

import { getPythonApiUrl } from "@/app/api/_utils/backend";
import { validateFirebaseToken } from "@/lib/auth/validate";
import { isDevelopment, logSecurityEvent } from "@/lib/config";

export const dynamic = "force-dynamic";

const PYTHON_API_URL = getPythonApiUrl();

type VaultWrapper = {
  method: string;
  encryptedVaultKey: string;
  salt: string;
  iv: string;
  passkeyCredentialId?: string;
  passkeyPrfSalt?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      vaultKeyHash,
      primaryMethod,
      recoveryEncryptedVaultKey,
      recoverySalt,
      recoveryIv,
      wrappers,
    } = body as {
      userId?: string;
      vaultKeyHash?: string;
      primaryMethod?: string;
      recoveryEncryptedVaultKey?: string;
      recoverySalt?: string;
      recoveryIv?: string;
      wrappers?: VaultWrapper[];
    };

    if (
      !userId ||
      !vaultKeyHash ||
      !primaryMethod ||
      !recoveryEncryptedVaultKey ||
      !recoverySalt ||
      !recoveryIv ||
      !Array.isArray(wrappers) ||
      wrappers.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required vault state fields" },
        { status: 400 }
      );
    }

    if (!wrappers.some((wrapper) => wrapper.method === "passphrase")) {
      return NextResponse.json(
        { error: "Passphrase wrapper is required" },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("Authorization");
    if (authHeader) {
      const validation = await validateFirebaseToken(authHeader);
      if (!validation.valid && !isDevelopment()) {
        return NextResponse.json(
          { error: "Authentication failed", code: "AUTH_INVALID" },
          { status: 401 }
        );
      }
    }

    const response = await fetch(`${PYTHON_API_URL}/db/vault/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        userId,
        vaultKeyHash,
        primaryMethod,
        recoveryEncryptedVaultKey,
        recoverySalt,
        recoveryIv,
        wrappers,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Backend error" },
        { status: response.status }
      );
    }

    const result = await response.json();
    logSecurityEvent("VAULT_SETUP_SUCCESS", { userId, primaryMethod });
    return NextResponse.json({ success: !!result.success });
  } catch (error) {
    console.error("Vault setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
