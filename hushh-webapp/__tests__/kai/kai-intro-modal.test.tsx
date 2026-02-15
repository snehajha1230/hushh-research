import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { KaiIntroModal } from "@/components/kai/onboarding/kai-intro-modal";

describe("KaiIntroModal", () => {
  it("advances from step 1 to step 2", async () => {
    const onComplete = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <KaiIntroModal
        open
        profile={null}
        onComplete={onComplete}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Step 2 of 2")).toBeTruthy();
  });

  it("submits skippable payload and closes via open change callback", async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    render(
      <KaiIntroModal
        open
        profile={null}
        onComplete={onComplete}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip all" }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith({
        intro_seen: true,
        investment_horizon: null,
        investment_style: null,
      });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
