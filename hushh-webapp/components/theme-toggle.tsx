"use client";

import { useEffect, useMemo, useState } from "react";
import { Moon, Monitor, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { SegmentedPill, type SegmentedPillOption } from "@/lib/morphy-ux/ui";

type ThemeOption = "light" | "dark" | "system";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const options = useMemo<SegmentedPillOption[]>(
    () => [
      { value: "light", icon: Sun, label: "Light" },
      { value: "dark", icon: Moon, label: "Dark" },
      { value: "system", icon: Monitor, label: "System" },
    ],
    []
  );

  if (!mounted) return null;

  const activeTheme: ThemeOption = (theme as ThemeOption) || "system";

  return (
    <SegmentedPill
      size="compact"
      value={activeTheme}
      options={options}
      onValueChange={(next) => {
        if (next === activeTheme) return;
        setTheme(next as ThemeOption);
      }}
      ariaLabel="Theme selector"
      className={cn("w-[200px] sm:w-[216px]", className)}
    />
  );
}
