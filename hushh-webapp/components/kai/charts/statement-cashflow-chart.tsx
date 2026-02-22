"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/morphy-ux/card";
import { cn } from "@/lib/utils";

export interface StatementCashflowDatum {
  key: string;
  label: string;
  value: number;
  tone: "positive" | "negative" | "neutral";
}

interface StatementCashflowChartProps {
  data: StatementCashflowDatum[];
  className?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatAxisValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

function barColorForTone(tone: StatementCashflowDatum["tone"]): string {
  if (tone === "positive") return "hsl(var(--chart-2))";
  if (tone === "negative") return "hsl(var(--destructive))";
  return "hsl(var(--chart-1))";
}

export function StatementCashflowChart({
  data,
  className,
}: StatementCashflowChartProps) {
  const rows = useMemo(
    () => data.filter((row) => Number.isFinite(row.value)),
    [data]
  );

  if (rows.length < 2) {
    return null;
  }

  const chartConfig: ChartConfig = {
    value: {
      label: "Amount",
      color: "hsl(var(--chart-1))",
    },
  };

  return (
    <Card
      variant="none"
      effect="glass"
      className={cn("min-w-0 overflow-hidden rounded-[22px]", className)}
    >
      <CardHeader className="pb-2 px-5 pt-5">
        <CardTitle className="text-sm">Statement Cashflow Signals</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <BarChart
            accessibilityLayer
            data={rows}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.95}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={formatAxisValue}
              width={58}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCurrency(value as number)}
                />
              }
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {rows.map((row) => (
                <Cell key={row.key} fill={barColorForTone(row.tone)} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

