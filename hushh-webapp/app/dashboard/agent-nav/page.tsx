"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ROUTES } from "@/lib/navigation/routes";

export default function LegacyDashboardAgentNavRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(ROUTES.AGENT_NAV);
  }, [router]);

  return null;
}
