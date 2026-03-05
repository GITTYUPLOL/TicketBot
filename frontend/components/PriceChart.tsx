"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

interface PricePoint {
  date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  volume: number;
}

export default function PriceChart({ data, height = 300 }: { data: PricePoint[]; height?: number }) {
  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
        <YAxis className="text-xs" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((value: any, name: any) => [`$${value}`, String(name).replace("_", " ")]) as any}
        />
        <Area type="monotone" dataKey="avg_price" stroke="hsl(var(--chart-1))" fill="url(#avgGradient)" strokeWidth={2} name="Avg Price" />
        <Line type="monotone" dataKey="min_price" stroke="hsl(var(--chart-2))" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Min Price" />
        <Line type="monotone" dataKey="max_price" stroke="hsl(var(--chart-5))" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Max Price" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
