"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AppPageShell } from "@/components/app-ui/app-page-shell";
import { HushhLoader } from "@/components/app-ui/hushh-loader";
import { ROUTES } from "@/lib/navigation/routes";

export default function RiaRequestsAliasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    const view = searchParams.get("view")?.trim();
    params.set("view", view || "pending");
    router.replace(`${ROUTES.CONSENTS}?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <AppPageShell as="div" width="content" className="flex min-h-72 items-center justify-center">
      <HushhLoader variant="inline" label="Redirecting to consents…" />
    </AppPageShell>
  );
}
