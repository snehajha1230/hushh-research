"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  RiaCompatibilityState,
  RiaPageShell,
  RiaStatusPanel,
  RiaSurface,
} from "@/components/ria/ria-page-shell";
import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/lib/navigation/routes";
import {
  isIAMSchemaNotReadyError,
  RiaService,
  type RiaOnboardingStatus,
} from "@/lib/services/ria-service";
import { usePersonaState } from "@/lib/persona/persona-context";

const STEPS = [
  "Welcome",
  "Identity",
  "Credentials",
  "Firm",
  "Public Profile",
  "Preferences",
  "Activate",
] as const;

function formatVerificationStatus(
  status?: string | null,
  loading?: boolean,
  lane: "advisory" | "brokerage" = "advisory"
) {
  if (loading) return "Loading";
  switch (status) {
    case "verified":
      return lane === "brokerage" ? "Broker verified" : "IAPD verified";
    case "active":
      return "Active";
    case "bypassed":
      return "Bypassed";
    case "submitted":
      return "Submitted";
    case "rejected":
      return "Rejected";
    case "draft":
    default:
      return "Draft";
  }
}

function verificationTone(status?: string | null): "neutral" | "warning" | "success" | "critical" {
  switch (status) {
    case "active":
    case "verified":
    case "bypassed":
      return "success";
    case "submitted":
      return "warning";
    case "rejected":
      return "critical";
    case "draft":
    default:
      return "neutral";
  }
}

const STEP_CONTEXT = [
  {
    decision: "Why should an investor trust this advisor shell at all?",
    detail:
      "Lead with verification and consent boundaries first. The product only earns access after the trust surface is clear.",
  },
  {
    decision: "What name should an investor recognize immediately?",
    detail:
      "Use the professional identity clients already know. This name will carry into the marketplace, invite confirmation, and consent flow.",
  },
  {
    decision: "Can the system verify this advisor against regulatory records?",
    detail:
      "Verification stays fail-closed. Advisory access is hard-gated on official IAPD verification, while broker capability follows a separate verification lane.",
  },
  {
    decision: "What firm context helps investors place the advisor correctly?",
    detail:
      "Capture only the primary firm and role here. Additional memberships can be managed later without making onboarding feel like back-office data entry.",
  },
  {
    decision: "What should an investor see before accepting an invite?",
    detail:
      "Keep the public profile brief, specific, and credible. This is the trust layer that appears before any consent request exists.",
  },
  {
    decision: "How should Kai communicate once the advisor is live?",
    detail:
      "Choose a stable default. Avoid deep preference debt during onboarding and leave nuanced tuning for the operational settings surface.",
  },
  {
    decision: "Is the advisor ready to enter the live RIA workspace?",
    detail:
      "Activation should confirm status, not ask for more work. Once submitted, the next step is client acquisition and consent management.",
  },
] as const;

export default function RiaOnboardingPage() {
  const { user } = useAuth();
  const { devRiaBypassAllowed, refresh: refreshPersonaState } = usePersonaState();
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<RiaOnboardingStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iamUnavailable, setIamUnavailable] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [requestAdvisory, setRequestAdvisory] = useState(true);
  const [individualLegalName, setIndividualLegalName] = useState("");
  const [individualCrd, setIndividualCrd] = useState("");
  const [advisoryFirmIapdNumber, setAdvisoryFirmIapdNumber] = useState("");
  const [advisoryFirmName, setAdvisoryFirmName] = useState("");
  const [brokerFirmName, setBrokerFirmName] = useState("");
  const [brokerFirmCrd, setBrokerFirmCrd] = useState("");
  const [requestBrokerage, setRequestBrokerage] = useState(false);
  const [firmRole, setFirmRole] = useState("");
  const [bio, setBio] = useState("");
  const [strategy, setStrategy] = useState("");
  const [disclosuresUrl, setDisclosuresUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [communicationStyle, setCommunicationStyle] = useState("balanced");
  const [alertCadence, setAlertCadence] = useState("daily_digest");

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setIamUnavailable(false);
        const idToken = await user.getIdToken();
        const next = await RiaService.getOnboardingStatus(idToken);
        if (cancelled) return;
        setStatus(next);
        const requestedCapabilities = next.requested_capabilities || ["advisory"];
        setDisplayName(next.display_name || "");
        setRequestAdvisory(
          requestedCapabilities.length === 0 || requestedCapabilities.includes("advisory")
        );
        setIndividualLegalName(next.individual_legal_name || next.legal_name || "");
        setIndividualCrd(next.individual_crd || next.finra_crd || "");
        setAdvisoryFirmIapdNumber(next.advisory_firm_iapd_number || next.sec_iard || "");
        setAdvisoryFirmName(next.advisory_firm_legal_name || "");
        setBrokerFirmName(next.broker_firm_legal_name || "");
        setBrokerFirmCrd(next.broker_firm_crd || "");
        setRequestBrokerage(requestedCapabilities.includes("brokerage"));
      } catch (loadError) {
        if (!cancelled) {
          setStatus(null);
          setIamUnavailable(isIAMSchemaNotReadyError(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const advisoryVerificationStatus = status?.advisory_status || status?.verification_status || "draft";
  const brokerageVerificationStatus = status?.brokerage_status || "draft";
  const advisoryAccessReady =
    advisoryVerificationStatus === "active" ||
    advisoryVerificationStatus === "verified" ||
    advisoryVerificationStatus === "bypassed";
  const brokerageAccessReady =
    brokerageVerificationStatus === "active" ||
    brokerageVerificationStatus === "verified" ||
    brokerageVerificationStatus === "bypassed";
  const requestedCapabilities = [
    requestAdvisory ? "advisory" : null,
    requestBrokerage ? "brokerage" : null,
  ].filter((value): value is string => Boolean(value));
  const canProceed = useMemo(() => {
    if (step === 1) return Boolean(displayName.trim() && (requestAdvisory || requestBrokerage));
    if (step === 2) return Boolean(individualLegalName.trim() && individualCrd.trim());
    if (step === 3) {
      if (!requestAdvisory && !requestBrokerage) return false;
      if (requestAdvisory && (!advisoryFirmName.trim() || !advisoryFirmIapdNumber.trim())) {
        return false;
      }
      if (requestBrokerage && (!brokerFirmName.trim() || !brokerFirmCrd.trim())) return false;
      return true;
    }
    if (step === 4) return Boolean(strategy.trim() || bio.trim() || headline.trim());
    return true;
  }, [
    advisoryFirmIapdNumber,
    advisoryFirmName,
    bio,
    brokerFirmCrd,
    brokerFirmName,
    displayName,
    headline,
    individualCrd,
    individualLegalName,
    requestAdvisory,
    requestBrokerage,
    step,
    strategy,
  ]);
  const currentStepContext = STEP_CONTEXT[step] ?? STEP_CONTEXT[0];
  const verificationLabel = formatVerificationStatus(advisoryVerificationStatus, loading);
  const verificationHelper = status?.latest_advisory_event || status?.latest_verification_event
    ? `${(status?.latest_advisory_event || status?.latest_verification_event)?.outcome} • ${new Date((status?.latest_advisory_event || status?.latest_verification_event)!.checked_at).toLocaleDateString()}`
    : advisoryVerificationStatus === "draft" || !advisoryVerificationStatus
      ? "Verification starts after activation"
      : "Verification updates appear here first";
  const nextUnlock =
    advisoryAccessReady
      ? "RIA workspace available"
      : brokerageAccessReady
        ? "Broker capability verified"
      : step === STEPS.length - 1
        ? "Waiting on verification"
        : "Complete onboarding to submit";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const result = await RiaService.submitOnboarding(idToken, {
        display_name: displayName,
        requested_capabilities: requestedCapabilities,
        individual_legal_name: individualLegalName || undefined,
        individual_crd: individualCrd || undefined,
        advisory_firm_legal_name: advisoryFirmName || undefined,
        advisory_firm_iapd_number: advisoryFirmIapdNumber || undefined,
        broker_firm_legal_name: brokerFirmName || undefined,
        broker_firm_crd: brokerFirmCrd || undefined,
        bio: bio || undefined,
        strategy: strategy || undefined,
        disclosures_url: disclosuresUrl || undefined,
        primary_firm_role: firmRole || undefined,
      });
      setStatus((current) => ({
        ...(current || { exists: true }),
        display_name: displayName,
        requested_capabilities: result.requested_capabilities,
        individual_legal_name: individualLegalName || undefined,
        individual_crd: individualCrd || undefined,
        advisory_firm_legal_name: advisoryFirmName || undefined,
        advisory_firm_iapd_number: advisoryFirmIapdNumber || undefined,
        broker_firm_legal_name: brokerFirmName || undefined,
        broker_firm_crd: brokerFirmCrd || undefined,
        verification_status: result.verification_status,
        advisory_status: result.advisory_status,
        brokerage_status: result.brokerage_status,
      }));

      await RiaService.setRiaMarketplaceDiscoverability(idToken, {
        enabled: true,
        headline: headline || undefined,
        strategy_summary: strategy || undefined,
      }).catch(() => null);
      await refreshPersonaState({ force: true });

      setStep(STEPS.length - 1);
    } catch (submitError) {
      if (isIAMSchemaNotReadyError(submitError)) {
        setIamUnavailable(true);
      }
      setError(submitError instanceof Error ? submitError.message : "Failed to submit onboarding");
    } finally {
      setSaving(false);
    }
  }

  async function onDevActivate() {
    if (!user) return;

    setSaving(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const result = await RiaService.activateDevRia(idToken, {
        display_name:
          displayName || individualLegalName || user.displayName || user.email || "RIA User",
        requested_capabilities: requestedCapabilities,
        individual_legal_name: individualLegalName || undefined,
        individual_crd: individualCrd || undefined,
        advisory_firm_legal_name: advisoryFirmName || undefined,
        advisory_firm_iapd_number: advisoryFirmIapdNumber || undefined,
        broker_firm_legal_name: brokerFirmName || undefined,
        broker_firm_crd: brokerFirmCrd || undefined,
        bio: bio || undefined,
        strategy: strategy || undefined,
        disclosures_url: disclosuresUrl || undefined,
        primary_firm_role: firmRole || undefined,
      });
      setStatus((current) => ({
        ...(current || { exists: true }),
        display_name:
          displayName || individualLegalName || user.displayName || user.email || "RIA User",
        requested_capabilities: result.requested_capabilities,
        individual_legal_name: individualLegalName || undefined,
        individual_crd: individualCrd || undefined,
        advisory_firm_legal_name: advisoryFirmName || undefined,
        advisory_firm_iapd_number: advisoryFirmIapdNumber || undefined,
        broker_firm_legal_name: brokerFirmName || undefined,
        broker_firm_crd: brokerFirmCrd || undefined,
        verification_status: result.verification_status,
        advisory_status: result.advisory_status,
        brokerage_status: result.brokerage_status,
        dev_ria_bypass_allowed: true,
      }));

      await RiaService.setRiaMarketplaceDiscoverability(idToken, {
        enabled: true,
        headline: headline || undefined,
        strategy_summary: strategy || undefined,
      }).catch(() => null);
      await refreshPersonaState({ force: true });
      setStep(STEPS.length - 1);
    } catch (activateError) {
      if (isIAMSchemaNotReadyError(activateError)) {
        setIamUnavailable(true);
      }
      setError(
        activateError instanceof Error ? activateError.message : "Failed to activate dev RIA"
      );
    } finally {
      setSaving(false);
    }
  }

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <RiaSurface className="bg-gradient-to-br from-primary/10 via-card/95 to-card/88">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
              Verified advisory activation
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              Build trust before you ask for data
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              This onboarding keeps the compliance-heavy work focused and short: identity,
              credentials, firm context, public profile, then activation. Verification stays
              fail-closed the whole time.
            </p>
          </RiaSurface>
        );
      case 1:
        return (
          <RiaSurface>
            <h2 className="text-xl font-semibold text-foreground">Identity</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with the professional name clients should recognize immediately.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-3 rounded-3xl border border-border bg-background/80 p-4 md:col-span-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Requested capabilities
                </span>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setRequestAdvisory((current) => !current || !requestBrokerage)}
                    className={`min-h-11 rounded-full px-4 text-sm font-medium ${
                      requestAdvisory
                        ? "bg-foreground text-background"
                        : "border border-border bg-background text-foreground"
                    }`}
                  >
                    Advisory
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestBrokerage((current) => !current || !requestAdvisory)}
                    className={`min-h-11 rounded-full px-4 text-sm font-medium ${
                      requestBrokerage
                        ? "bg-foreground text-background"
                        : "border border-border bg-background text-foreground"
                    }`}
                  >
                    Brokerage
                  </button>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Advisory unlocks the current RIA workspace after IAPD verification. Brokerage is
                  tracked separately and does not imply advisory approval.
                </p>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Display name
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="min-h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  placeholder="Manish Sainani"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Individual legal name
                </span>
                <input
                  value={individualLegalName}
                  onChange={(event) => setIndividualLegalName(event.target.value)}
                  className="min-h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  placeholder="Full legal adviser or broker name"
                />
              </label>
            </div>
          </RiaSurface>
        );
      case 2:
        return (
          <RiaSurface>
            <h2 className="text-xl font-semibold text-foreground">Credentials</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Both capability lanes rely on the individual legal name and the official CRD used for
              regulator matching. Advisory also requires the adviser firm IAPD record in the next
              step.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Individual CRD
                </span>
                <input
                  value={individualCrd}
                  onChange={(event) => setIndividualCrd(event.target.value)}
                  className="min-h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  placeholder="CRD number"
                />
              </label>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              We require the professional legal name and CRD before any advisory or brokerage
              verification can start.
            </p>
          </RiaSurface>
        );
      case 3:
        return (
          <RiaSurface>
            <h2 className="text-xl font-semibold text-foreground">Firm</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Capture the official firm records for each requested capability. Advisory uses the
              IAPD/IARD firm number. Brokerage uses the broker-dealer firm CRD.
            </p>
            <div className="mt-5 space-y-6">
              {requestAdvisory ? (
                <div className="grid gap-4 rounded-3xl border border-border bg-background/80 p-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Advisory firm
                    </p>
                  </div>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Firm legal name
                    </span>
                    <input
                      value={advisoryFirmName}
                      onChange={(event) => setAdvisoryFirmName(event.target.value)}
                      className="min-h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                      placeholder="Registered advisory firm name"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Firm IAPD number
                    </span>
                    <input
                      value={advisoryFirmIapdNumber}
                      onChange={(event) => setAdvisoryFirmIapdNumber(event.target.value)}
                      className="min-h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                      placeholder="IAPD / IARD number"
                    />
                  </label>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Role title
                    </span>
                    <input
                      value={firmRole}
                      onChange={(event) => setFirmRole(event.target.value)}
                      className="min-h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                      placeholder="Founding advisor, partner, CIO..."
                    />
                  </label>
                </div>
              ) : null}

              {requestBrokerage ? (
                <div className="grid gap-4 rounded-3xl border border-border bg-background/80 p-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Broker firm
                    </p>
                  </div>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Firm legal name
                    </span>
                    <input
                      value={brokerFirmName}
                      onChange={(event) => setBrokerFirmName(event.target.value)}
                      className="min-h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                      placeholder="Registered broker-dealer name"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Firm CRD
                    </span>
                    <input
                      value={brokerFirmCrd}
                      onChange={(event) => setBrokerFirmCrd(event.target.value)}
                      className="min-h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                      placeholder="Broker-dealer firm CRD"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </RiaSurface>
        );
      case 4:
        return (
          <RiaSurface>
            <h2 className="text-xl font-semibold text-foreground">Public profile</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This becomes the trust layer on marketplace cards and invite confirmations.
            </p>
            <div className="mt-5 space-y-4">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Headline
                </span>
                <input
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                  className="min-h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  placeholder="Tax-aware wealth planning for cross-border founders"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Advisory strategy
                </span>
                <textarea
                  value={strategy}
                  onChange={(event) => setStrategy(event.target.value)}
                  className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  placeholder="What clients should understand about your style and specialization"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Bio
                </span>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  className="min-h-24 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm"
                  placeholder="Professional background and client promise"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Disclosures URL
                </span>
                <input
                  value={disclosuresUrl}
                  onChange={(event) => setDisclosuresUrl(event.target.value)}
                  className="min-h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  placeholder="https://..."
                />
              </label>
            </div>
          </RiaSurface>
        );
      case 5:
        return (
          <RiaSurface>
            <h2 className="text-xl font-semibold text-foreground">Preferences</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep this simple. The first version optimizes for clarity and operational cadence, not
              deep configuration debt.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Communication style
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["concise", "balanced", "detailed"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setCommunicationStyle(option)}
                      className={`min-h-11 rounded-full px-4 text-sm font-medium ${
                        communicationStyle === option
                          ? "bg-foreground text-background"
                          : "border border-border bg-background text-foreground"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Alert cadence
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["live", "daily_digest", "weekly"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setAlertCadence(option)}
                      className={`min-h-11 rounded-full px-4 text-sm font-medium ${
                        alertCadence === option
                          ? "bg-foreground text-background"
                          : "border border-border bg-background text-foreground"
                      }`}
                    >
                      {option.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </RiaSurface>
        );
      default:
        return (
          <RiaSurface className="bg-gradient-to-br from-primary/10 via-card/95 to-card/88">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
              Activation state
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {advisoryAccessReady
                ? "Verification passed. Advisory workspace is ready."
                : brokerageAccessReady
                  ? "Broker capability verified. Advisory workspace is still gated."
                  : "Onboarding submitted. Verification is in progress."}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Communication style is set to <strong>{communicationStyle}</strong> and cadence to{" "}
              <strong>{alertCadence.replace("_", " ")}</strong>. Public profile data is staged, and
              discoverability only turns on after the advisory lane reaches a trusted state.
            </p>
            {advisoryAccessReady ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={ROUTES.RIA_HOME}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
                >
                  Open RIA Home
                </Link>
                <Link
                  href={ROUTES.RIA_CLIENTS}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background/60 px-4 text-sm font-medium text-foreground"
                >
                  Open Clients
                </Link>
              </div>
            ) : null}
          </RiaSurface>
        );
    }
  }

  return (
    <RiaPageShell
      eyebrow="Professional Onboarding"
      title="Verify the licensed professional before unlocking the workflow"
      description="Progressive disclosure keeps onboarding short: identity, regulatory records, firm context, and the public trust surface clients will actually see."
      statusPanel={
        iamUnavailable ? null : (
          <RiaStatusPanel
            title="Verification state is the primary control point"
            description="Keep the regulatory status visible while the form moves forward. Investors should never feel that trust state is hidden below the fold."
            items={[
              {
                label: "Verification",
                value: verificationLabel,
                helper: verificationHelper,
                tone: verificationTone(advisoryVerificationStatus),
              },
              ...(requestBrokerage
                ? [
                    {
                      label: "Brokerage",
                      value: formatVerificationStatus(
                        brokerageVerificationStatus,
                        false,
                        "brokerage"
                      ),
                      helper:
                        brokerageAccessReady
                          ? "Broker capability cleared its separate verification lane."
                          : "Broker capability remains isolated from advisory access.",
                      tone: verificationTone(brokerageVerificationStatus),
                    },
                  ]
                : []),
              {
                label: "Capabilities",
                value:
                  requestedCapabilities.length > 0
                    ? requestedCapabilities.join(" + ")
                    : "None selected",
                helper: "Advisory unlocks the current workspace. Brokerage stays separate.",
                tone: "neutral",
              },
              {
                label: "Step",
                value: `${step + 1} / ${STEPS.length}`,
                helper: STEPS[step],
                tone: "neutral",
              },
              {
                label: "Next unlock",
                value: nextUnlock,
                helper:
                  advisoryAccessReady
                    ? "Marketplace and client acquisition are available"
                    : brokerageAccessReady
                      ? "Broker evidence is stored, but advisory workflows stay gated"
                    : "Requests stay gated until trusted status is reached",
                tone:
                  advisoryAccessReady
                    ? "success"
                    : "warning",
              },
              {
                label: "Profile identity",
                value: displayName || individualLegalName || user?.displayName || "Not set",
                helper: "This name appears in invites and public discovery",
                tone: "neutral",
              },
            ]}
            actions={
              advisoryAccessReady ? (
                <Link
                  href={ROUTES.RIA_HOME}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
                >
                  Open RIA Home
                </Link>
              ) : null
            }
          />
        )
      }
    >
      {iamUnavailable ? (
        <RiaCompatibilityState
          title="RIA onboarding is unavailable in this environment"
          description="The app is currently connected to an IAM-incomplete database. The UI is ready, but backend activation still requires the IAM migrations and verification tables."
        />
      ) : null}

      <RiaSurface className="flex flex-wrap items-center gap-3">
        {STEPS.map((label, index) => (
          <div
            key={label}
            className={`flex min-h-11 items-center rounded-full px-4 text-sm font-medium ${
              index === step
                ? "bg-foreground text-background"
                : index < step
                  ? "border border-primary/20 bg-primary/10 text-primary"
                  : "border border-border bg-background text-muted-foreground"
            }`}
          >
            {index + 1}. {label}
          </div>
        ))}
      </RiaSurface>

      <RiaSurface className="bg-gradient-to-br from-primary/10 via-card/95 to-card/88">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">{currentStepContext.decision}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {currentStepContext.detail}
        </p>
      </RiaSurface>

      {!iamUnavailable ? (
        <form className="space-y-5" onSubmit={onSubmit}>
          {renderStep()}

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <div className="flex flex-wrap justify-end gap-3">
            {step < STEPS.length - 1 ? (
              <div className="flex flex-wrap gap-3">
                {step === STEPS.length - 2 && devRiaBypassAllowed ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void onDevActivate()}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground disabled:opacity-60"
                  >
                    {saving ? "Activating..." : "Bypass In Dev/UAT"}
                  </button>
                ) : null}
                <button
                  type={step === STEPS.length - 2 ? "submit" : "button"}
                  disabled={!canProceed || saving}
                  onClick={
                    step === STEPS.length - 2
                      ? undefined
                      : () => setStep((value) => Math.min(STEPS.length - 1, value + 1))
                  }
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
                >
                  {step === STEPS.length - 2
                    ? saving
                      ? "Submitting..."
                      : "Submit for verification"
                    : "Continue"}
                </button>
              </div>
            ) : null}
          </div>
        </form>
      ) : null}
    </RiaPageShell>
  );
}
