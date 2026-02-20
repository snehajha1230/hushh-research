import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/vault/vault-context", () => ({
  useVault: () => ({
    unlockVault: vi.fn(),
  }),
}));

vi.mock("@/lib/services/vault-service", () => ({
  VaultService: {
    checkVault: vi.fn(),
    createVault: vi.fn(),
    setupVaultState: vi.fn(),
    hashVaultKey: vi.fn(),
    setVaultCheckCache: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

import { VaultService } from "@/lib/services/vault-service";
import { VaultFlow } from "@/components/vault/vault-flow";

describe("VaultFlow passphrase-first setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves from intro to passphrase creation without generated-default shortcut", async () => {
    (VaultService.checkVault as any).mockResolvedValue(false);

    const onSuccess = vi.fn();

    render(
      <VaultFlow
        user={{ uid: "uid-1", displayName: "User" } as any}
        onSuccess={onSuccess}
        enableGeneratedDefault
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/secure your digital vault/i)).toBeTruthy();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /i understand, create vault/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/create your vault passphrase/i)).toBeTruthy();
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });
});
