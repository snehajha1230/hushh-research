"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ClientRedirectProps {
  to: string;
}

export function ClientRedirect({ to }: ClientRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace(to);
  }, [router, to]);

  return null;
}
