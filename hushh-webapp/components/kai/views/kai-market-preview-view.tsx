"use client";

import { AlertTriangle } from "lucide-react";

import { ConnectPortfolioCta } from "@/components/kai/cards/connect-portfolio-cta";
import { MarketOverviewGrid } from "@/components/kai/cards/market-overview-grid";
import { SpotlightCard } from "@/components/kai/cards/spotlight-card";
import { ThemeFocusList } from "@/components/kai/cards/theme-focus-list";
import { Card, CardContent } from "@/lib/morphy-ux/card";
import { Button } from "@/lib/morphy-ux/button";
import { Icon } from "@/lib/morphy-ux/ui";
import { useRouter } from "next/navigation";

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="mb-3 pl-1 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </h2>
  );
}

export function KaiMarketPreviewView() {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 pb-[calc(140px+var(--app-bottom-inset))]">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-black tracking-tight leading-tight">
          Explore the market with Kai
        </h1>
        <p className="mx-auto max-w-[22rem] text-sm text-muted-foreground">
          Structured insights, even before connecting your portfolio.
        </p>
        <div className="pt-2">
          <Button
            variant="none"
            effect="fade"
            size="default"
            onClick={() => router.push("/kai/dashboard")}
          >
            Open Dashboard
          </Button>
        </div>
      </header>

      <section className="mt-8">
        <SectionLabel>Today&apos;s Spotlight</SectionLabel>
        <div className="space-y-4">
          <SpotlightCard
            title="Tesla Inc."
            price="$248.50"
            decision="HOLD"
            summary="Cash flow remains strong while profit margins face short-term pressure."
            context="Moderate conviction • 3–6 month horizon"
          />
          <SpotlightCard
            title="Vanguard S&P 500 ETF (VOO)"
            price="$412.30"
            decision="BUY"
            summary="Broad exposure with institutional-grade cost efficiency."
            context="High conviction • Long-term horizon"
          />
        </div>
      </section>

      <section className="mt-8">
        <SectionLabel>Market Overview</SectionLabel>
        <MarketOverviewGrid />
      </section>

      <section className="mt-8">
        <Card variant="muted" effect="fill" className="rounded-xl p-0">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Icon icon={AlertTriangle} size="sm" className="text-muted-foreground" />
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                Scenario Simulation
              </span>
            </div>
            <p className="text-sm font-medium leading-relaxed">
              If markets decline 10%, highly concentrated portfolios may face amplified
              drawdowns.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <SectionLabel>Themes In Focus</SectionLabel>
        <ThemeFocusList />
      </section>

      <section className="mt-8">
        <ConnectPortfolioCta />
      </section>
    </div>
  );
}
