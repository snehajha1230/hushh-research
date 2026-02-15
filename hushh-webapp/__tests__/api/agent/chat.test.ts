// __tests__/api/agent/chat.test.ts

/**
 * Chat API Tests
 *
 * Tests /api/chat endpoint for:
 * - Firebase Auth validation (identity layer)
 * - Proper error responses
 */

import {
  createMockPOST,
  expectError,
  mockFetch,
} from "../../utils/test-helpers";
import { mockFirebaseHeader } from "../../utils/mock-tokens";
import { afterEach, vi } from "vitest";

vi.mock("@/lib/auth/validate", () => ({
  validateFirebaseToken: vi.fn(async (authHeader: string | null) => {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { valid: false, error: "Missing or invalid Authorization header" };
    }

    if (authHeader.includes("firebase_token_for_")) {
      return { valid: true, userId: "test_user", email: "test@example.com" };
    }

    return { valid: false, error: "Invalid Firebase ID token" };
  }),
}));

// Dynamic import
let route: { POST: Function };

beforeAll(async () => {
  route = await import("../../../app/api/chat/route");
});

afterEach(() => {
  process.env.ENVIRONMENT_MODE = "development";
});

describe("/api/chat", () => {
  describe("POST", () => {
    it("should require userId", async () => {
      const request = createMockPOST("/api/chat", {
        message: "Hello",
        // No userId
      });

      const response = await route.POST(request);
      expect(response.status).toBe(401);
    });

    it("should require Authorization header in production", async () => {
      process.env.ENVIRONMENT_MODE = "production";

      const request = createMockPOST("/api/chat", {
        message: "Hello",
        userId: "test_user",
      });

      const response = await route.POST(request);
      await expectError(response, 401, "AUTH_REQUIRED");

      process.env.ENVIRONMENT_MODE = "development";
    });

    it("should accept valid Firebase token", async () => {
      process.env.ENVIRONMENT_MODE = "production";

      // Mock orchestrator response
      mockFetch({
        response: "Hello! How can I help you?",
        delegation: null,
      });

      const request = createMockPOST(
        "/api/chat",
        {
          message: "Hello",
          userId: "test_user",
        },
        {
          Authorization: mockFirebaseHeader("test_user"),
        }
      );

      const response = await route.POST(request);
      // Should not be 401
      expect(response.status).not.toBe(401);
    });

    it("should allow chat without auth in development mode", async () => {
      process.env.ENVIRONMENT_MODE = "development";

      // Mock orchestrator response
      mockFetch({
        response: "Hello! How can I help you?",
        delegation: null,
      });

      const request = createMockPOST("/api/chat", {
        message: "Hello",
        userId: "test_user",
      });

      const response = await route.POST(request);
      expect(response.status).not.toBe(401);
    });
  });
});
