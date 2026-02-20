"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Compass,
  History,
  Search,
  Settings2,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  getTickerUniverseSnapshot,
  preloadTickerUniverse,
  searchTickerUniverse,
  type TickerUniverseRow,
} from "@/lib/kai/ticker-universe-cache";
import { Icon } from "@/lib/morphy-ux/ui";

export type KaiCommandAction =
  | "analyze"
  | "optimize"
  | "manage"
  | "history"
  | "dashboard"
  | "home";

interface KaiCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommand: (command: KaiCommandAction, params?: Record<string, unknown>) => void;
  hasPortfolioData?: boolean;
}

export function KaiCommandPalette({
  open,
  onOpenChange,
  onCommand,
  hasPortfolioData = true,
}: KaiCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [universe, setUniverse] = useState<TickerUniverseRow[] | null>(
    getTickerUniverseSnapshot()
  );
  const [loadingUniverse, setLoadingUniverse] = useState<boolean>(!universe);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (!universe) setLoadingUniverse(true);
        const rows = await preloadTickerUniverse();
        if (!cancelled) {
          setUniverse(rows);
        }
      } catch {
        if (!cancelled) {
          setUniverse((prev) => prev ?? []);
        }
      } finally {
        if (!cancelled) {
          setLoadingUniverse(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [universe]);

  const tickerMatches = useMemo(() => {
    const rows = universe ?? [];
    if (rows.length === 0) {
      return [];
    }
    const search = query.trim();
    if (!search) {
      return rows.slice(0, 12);
    }
    return searchTickerUniverse(rows, search, 20);
  }, [query, universe]);

  function run(command: KaiCommandAction, params?: Record<string, unknown>) {
    onOpenChange(false);
    setQuery("");
    onCommand(command, params);
  }

  const commandItemClass =
    "rounded-lg border border-transparent transition-colors duration-300 hover:bg-primary/10 hover:text-foreground data-[selected=true]:border-primary/25 data-[selected=true]:bg-primary/15 data-[selected=true]:text-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-45";

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Run Kai command or search ticker..."
      />
      <CommandList>
        <CommandEmpty>
          {loadingUniverse ? "Loading commands..." : "No matching commands."}
        </CommandEmpty>

        <CommandGroup heading="Portfolio Actions">
          <CommandItem className={commandItemClass} onSelect={() => run("dashboard")}>
            <Icon icon={BarChart3} size="sm" className="mr-2 text-muted-foreground" />
            Dashboard
          </CommandItem>
          <CommandItem
            className={commandItemClass}
            disabled={!hasPortfolioData}
            onSelect={() => run("optimize")}
          >
            <Icon icon={Activity} size="sm" className="mr-2 text-muted-foreground" />
            Optimize Portfolio
          </CommandItem>
          <CommandItem
            className={commandItemClass}
            disabled={!hasPortfolioData}
            onSelect={() => run("manage")}
          >
            <Icon icon={Settings2} size="sm" className="mr-2 text-muted-foreground" />
            Manage Portfolio
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Intelligence">
          <CommandItem
            className={commandItemClass}
            disabled={!hasPortfolioData}
            onSelect={() => run("history")}
          >
            <Icon icon={History} size="sm" className="mr-2 text-muted-foreground" />
            Analysis History
          </CommandItem>
          <CommandItem className={commandItemClass} onSelect={() => run("home")}>
            <Icon icon={Compass} size="sm" className="mr-2 text-muted-foreground" />
            Kai Home
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Analyze Stock">
          {!hasPortfolioData && (
            <CommandItem className={commandItemClass} disabled>
              Import portfolio to enable stock analysis.
            </CommandItem>
          )}
          {tickerMatches.map((row) => {
            const ticker = row.ticker.toUpperCase();
            const title = row.title || "Unknown company";
            return (
              <CommandItem
                className={commandItemClass}
                key={`${ticker}:${title}`}
                value={`${ticker} ${title}`}
                disabled={!hasPortfolioData}
                onSelect={() => run("analyze", { symbol: ticker })}
              >
                <Icon icon={Search} size="sm" className="mr-2 text-muted-foreground" />
                <span className="font-semibold">{ticker}</span>
                <span className="ml-2 text-xs text-muted-foreground truncate">
                  {title}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
