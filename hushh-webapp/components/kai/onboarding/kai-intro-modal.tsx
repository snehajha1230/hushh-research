"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import type { KaiIntroProfile } from "@/lib/services/kai-intro-service";

type KaiIntroCompletePayload = {
  intro_seen: boolean;
  investment_horizon: string | null;
  investment_style: string | null;
};

interface KaiIntroModalProps {
  open: boolean;
  profile: KaiIntroProfile | null;
  onComplete: (payload: KaiIntroCompletePayload) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
}

const HORIZON_OPTIONS = [
  { value: "short_term", label: "Short term (< 3 years)" },
  { value: "medium_term", label: "Medium term (3-7 years)" },
  { value: "long_term", label: "Long term (7+ years)" },
];

const STYLE_OPTIONS = [
  { value: "growth", label: "Growth" },
  { value: "value", label: "Value" },
  { value: "blend", label: "Blend" },
  { value: "income", label: "Income-focused" },
  { value: "index", label: "Index-first" },
];

export function KaiIntroModal({
  open,
  profile,
  onComplete,
  onOpenChange,
}: KaiIntroModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [horizon, setHorizon] = useState<string>("");
  const [style, setStyle] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep(1);
    setHorizon(profile?.investment_horizon || "");
    setStyle(profile?.investment_style || "");
  }, [open, profile?.investment_horizon, profile?.investment_style]);

  const progressLabel = useMemo(() => `Step ${step} of 2`, [step]);

  async function submitAndClose(payload: KaiIntroCompletePayload) {
    try {
      setSaving(true);
      await onComplete(payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleSkipStep() {
    if (step === 1) {
      setStep(2);
      return;
    }
    await submitAndClose({
      intro_seen: true,
      investment_horizon: horizon || null,
      investment_style: style || null,
    });
  }

  async function handleSkipAll() {
    await submitAndClose({
      intro_seen: true,
      investment_horizon: horizon || null,
      investment_style: style || null,
    });
  }

  async function handlePrimaryAction() {
    if (step === 1) {
      setStep(2);
      return;
    }
    await submitAndClose({
      intro_seen: true,
      investment_horizon: horizon || null,
      investment_style: style || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Personalize Kai
          </DialogTitle>
          <DialogDescription>
            Optional setup for better context. You can skip now and update later from the dashboard menu.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{progressLabel}</p>

          {step === 1 ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium">Investment horizon (optional)</p>
              <Select value={horizon || undefined} onValueChange={setHorizon}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a horizon" />
                </SelectTrigger>
                <SelectContent>
                  {HORIZON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium">Investment style (optional)</p>
              <Select value={style || undefined} onValueChange={setStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an investment style" />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSkipStep} disabled={saving}>
              {step === 1 ? "Skip" : "Skip this step"}
            </Button>
            <Button variant="ghost" onClick={handleSkipAll} disabled={saving}>
              Skip all
            </Button>
          </div>
          <Button onClick={handlePrimaryAction} disabled={saving}>
            {step === 1 ? "Continue" : "Save and continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
