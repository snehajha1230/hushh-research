"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { KaiCommandPalette, type KaiCommandAction } from "@/components/kai/kai-command-palette";
import { Button } from "@/lib/morphy-ux/button";
import { Icon } from "@/lib/morphy-ux/ui";
import { cn } from "@/lib/utils";

interface KaiSearchBarProps {
  onCommand: (command: KaiCommandAction, params?: Record<string, unknown>) => void;
  disabled?: boolean;
  hasPortfolioData?: boolean;
}

export function KaiSearchBar({
  onCommand,
  disabled = false,
  hasPortfolioData = true,
}: KaiSearchBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-[var(--app-bottom-inset)] inset-x-0 z-[130] flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto w-[315px]">
          <Button
            variant="none"
            effect="fade"
            fullWidth
            size="default"
            className={cn(
              "h-12 justify-start rounded-full px-4 text-sm text-muted-foreground",
              disabled && "pointer-events-none opacity-50"
            )}
            onClick={() => setOpen(true)}
          >
            <Icon icon={Search} size="sm" className="mr-2 text-muted-foreground" />
            Analyze, optimize, manage with Kai
          </Button>
        </div>
      </div>

      <KaiCommandPalette
        open={open}
        onOpenChange={setOpen}
        onCommand={onCommand}
        hasPortfolioData={hasPortfolioData}
      />
    </>
  );
}
