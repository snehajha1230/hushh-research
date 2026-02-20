import { NextRequest, NextResponse } from "next/server";

import { getPythonApiUrl } from "@/app/api/_utils/backend";
import { validateFirebaseToken } from "@/lib/auth/validate";
import { isDevelopment } from "@/lib/config";

export const dynamic = "force-dynamic";

const PYTHON_API_URL = getPythonApiUrl();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, primaryMethod } = body as {
      userId?: string;
      primaryMethod?: string;
    };

    if (!userId || !primaryMethod) {
      return NextResponse.json(
        { error: "Missing required primary method fields" },
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

    const response = await fetch(`${PYTHON_API_URL}/db/vault/primary/set`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ userId, primaryMethod }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Backend error" },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({ success: !!result.success });
  } catch (error) {
    console.error("Vault primary set error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
