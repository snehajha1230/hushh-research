import { describe, expect, it, beforeEach } from "vitest";

import { getKaiChromeState } from "@/lib/navigation/kai-chrome-state";

describe("getKaiChromeState", () => {
  beforeEach(() => {
    document.cookie = "kai_onboarding_flow_active=0; path=/";
  });

  it("uses onboarding chrome on onboarding route, but not import for returning users", () => {
    expect(getKaiChromeState("/kai/onboarding").useOnboardingChrome).toBe(true);
    expect(getKaiChromeState("/kai/import").useOnboardingChrome).toBe(false);
    expect(getKaiChromeState("/kai/import").hideCommandBar).toBe(false);
  });

  it("enables onboarding chrome on import route when onboarding flow cookie is active", () => {
    document.cookie = "kai_onboarding_flow_active=1; path=/";
    const state = getKaiChromeState("/kai/import");
    expect(state.onboardingFlowActive).toBe(true);
    expect(state.hideCommandBar).toBe(true);
    expect(state.useOnboardingChrome).toBe(true);
  });
});
