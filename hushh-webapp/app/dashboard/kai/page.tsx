"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ROUTES } from "@/lib/navigation/routes";

export default function LegacyDashboardKaiRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(ROUTES.KAI_DASHBOARD);
  }, [router]);

  return null;
}
