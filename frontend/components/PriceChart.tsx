"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

interface PricePoint {
  date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  volume: number;
}

export default function PriceChart({ data, height = 300 }: { data: PricePoint[]; height?: number }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const updateThemeState = () => setIsDark(document.documentElement.classList.contains("dark"));
    updateThemeState();
    const observer = new MutationObserver(updateThemeState);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const avgColor = isDark ? "#ff6ad5" : "hsl(var(--chart-1))";
  const minColor = isDark ? "#66e2ff" : "hsl(var(--chart-2))";
  const maxColor = isDark ? "#ffd166" : "hsl(var(--chart-5))";
  const gridColor = isDark ? "rgba(255,255,255,0.16)" : "hsl(var(--border))";
  const tooltipBackground = isDark ? "#1f1530" : "hsl(var(--card))";
  const gradientId = isDark ? "avgGradientDark" : "avgGradientLight";

  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={avgColor} stopOpacity={0.35} />
            <stop offset="95%" stopColor={avgColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
        <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{ background: tooltipBackground, border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((value: any, name: any) => [`$${value}`, String(name).replace("_", " ")]) as any}
        />
        <Area type="monotone" dataKey="avg_price" stroke={avgColor} fill={`url(#${gradientId})`} strokeWidth={2.5} name="Avg Price" />
        <Line type="monotone" dataKey="min_price" stroke={minColor} strokeWidth={1.6} strokeDasharray="4 4" dot={false} name="Min Price" />
        <Line type="monotone" dataKey="max_price" stroke={maxColor} strokeWidth={1.6} strokeDasharray="4 4" dot={false} name="Max Price" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
