"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import PriceChart from "@/components/PriceChart";
import DemandBadge from "@/components/DemandBadge";
import { getUpcomingOpportunities, getMarketHeatmap, getPriceHistory, syncLiveData, getBatchReadiness, getDashboardQuickView } from "@/lib/api";
import { DollarSign, Activity, CalendarClock, Music, Ticket, Zap, CheckCircle, AlertTriangle, XCircle, Users, Crosshair, ShoppingCart, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const DEFAULT_MIN_ROI = "25";
const DEFAULT_MIN_CONFIDENCE = "medium";

type SaleWindow = "7d" | "14d" | "30d";

interface UpcomingOpportunity {
  id: number;
  name: string;
  artist: string;
  venue: string;
  city: string;
  date: string;
  on_sale_date: string;
  demand_score: number;
  projected_entry_price: number;
  projected_resale_price: number;
  projected_entry_range_low?: number | null;
  projected_entry_range_high?: number | null;
  projected_resale_range_low?: number | null;
  projected_resale_range_high?: number | null;
  estimated_roi: number;
  roi_confidence: "high" | "medium" | "low";
  price_estimate_status?: "blended" | "market_only" | "historical_modeled" | "unverified";
  price_estimate_confidence?: "high" | "medium" | "low";
  days_until_on_sale: number;
  on_sale_window: SaleWindow;
}

interface WindowStats { window_7d: number; window_14d: number; window_30d: number; }
interface UpcomingResponse { windows: WindowStats; opportunities: UpcomingOpportunity[]; }
interface PricePoint { date: string; avg_price: number; min_price: number; max_price: number; volume: number; }
interface HeatmapGenre { genre: string; event_count: number; avg_demand: number; avg_markup: number; avg_roi: number; }
interface HeatmapVenue { venue: string; city: string; event_count: number; avg_demand: number; avg_max_price: number; }
interface HeatmapData { genres: HeatmapGenre[]; venues: HeatmapVenue[]; }
interface ReadinessItem { event_id: number; readiness_score: number; readiness_status: string; has_accounts: boolean; has_card: boolean; has_rule: boolean; has_selectors: boolean; }
interface QuickViewSnapshot {
  events: { total: number; on_sale_7d: number; on_sale_30d: number; on_sale_60d: number; };
  autobuy: { total_rules: number; enabled_rules: number; active_snipe_rules: number; };
  accounts: { total_accounts: number; active_accounts: number; active_platforms: number; };
  orders: { total_orders: number; orders_30d: number; spend_30d: number; profit_30d: number; };
  sniper: { total_sessions: number; active_sessions: number; needs_input: number; };
}

function ReadinessIndicator({ readiness }: { readiness?: ReadinessItem }) {
  if (!readiness) return <span className="text-xs text-muted-foreground">...</span>;
  const { readiness_score, readiness_status } = readiness;
  const Icon = readiness_status === "go" ? CheckCircle : readiness_status === "partial" ? AlertTriangle : XCircle;
  const color = readiness_status === "go" ? "text-green-500" : readiness_status === "partial" ? "text-amber-500" : "text-red-500";
  const bg = readiness_status === "go" ? "bg-green-500/10" : readiness_status === "partial" ? "bg-amber-500/10" : "bg-red-500/10";
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color} ${bg}`}>
      <Icon className="h-3 w-3" />
      {readiness_score}%
    </div>
  );
}

function formatRange(low?: number | null, high?: number | null) {
  const l = typeof low === "number" ? Math.round(low) : null;
  const h = typeof high === "number" ? Math.round(high) : null;
  if (l === null && h === null) return "—";
  if (l !== null && h !== null && l !== h) return `$${l}-$${h}`;
  return `$${l ?? h}`;
}

function priceStatusLabel(status?: "blended" | "market_only" | "historical_modeled" | "unverified") {
  if (status === "blended") return "Blend";
  if (status === "market_only") return "Market";
  if (status === "historical_modeled") return "Historical";
  return "Unverified";
}

export default function Dashboard() {
  const [upcoming, setUpcoming] = useState<UpcomingOpportunity[]>([]);
  const [windowStats, setWindowStats] = useState<WindowStats>({ window_7d: 0, window_14d: 0, window_30d: 0 });
  const [heatmap, setHeatmap] = useState<HeatmapData>({ genres: [], venues: [] });
  const [readinessMap, setReadinessMap] = useState<Record<number, ReadinessItem>>({});
  const [selectedChart, setSelectedChart] = useState<number | null>(null);
  const [chartData, setChartData] = useState<PricePoint[]>([]);
  const [quickView, setQuickView] = useState<QuickViewSnapshot>({
    events: { total: 0, on_sale_7d: 0, on_sale_30d: 0, on_sale_60d: 0 },
    autobuy: { total_rules: 0, enabled_rules: 0, active_snipe_rules: 0 },
    accounts: { total_accounts: 0, active_accounts: 0, active_platforms: 0 },
    orders: { total_orders: 0, orders_30d: 0, spend_30d: 0, profit_30d: 0 },
    sniper: { total_sessions: 0, active_sessions: 0, needs_input: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [environment, setEnvironment] = useState<"live" | "test">("test");
  const [syncingLive, setSyncingLive] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string>("");
  const roiRanked = [...upcoming].sort((a, b) => b.estimated_roi - a.estimated_roi);
  const topRoiEvent = roiRanked[0];

  useEffect(() => {
    Promise.all([
      getUpcomingOpportunities({ min_roi: DEFAULT_MIN_ROI, min_confidence: DEFAULT_MIN_CONFIDENCE, upcoming_window: "7" }),
      getMarketHeatmap(),
      getDashboardQuickView(),
    ])
      .then(async ([upcomingResponse, h, quick]) => {
        const typedUpcoming = upcomingResponse as UpcomingResponse;
        const typedHeatmap = h as HeatmapData;
        const typedQuick = quick as QuickViewSnapshot;
        const opportunities = typedUpcoming?.opportunities || [];
        setUpcoming(opportunities);
        setWindowStats(typedUpcoming?.windows || { window_7d: 0, window_14d: 0, window_30d: 0 });
        setHeatmap(typedHeatmap);
        setQuickView(typedQuick);
        if (opportunities.length > 0) {
          setSelectedChart(opportunities[0].id);
          getPriceHistory(opportunities[0].id).then((data) => setChartData(data as PricePoint[]));
          // Fetch readiness for all upcoming events
          const ids = opportunities.map(o => o.id);
          const readiness = await getBatchReadiness(ids) as ReadinessItem[];
          const map: Record<number, ReadinessItem> = {};
          readiness.forEach(r => { map[r.event_id] = r; });
          setReadinessMap(map);
        } else {
          setSelectedChart(null);
          setChartData([]);
          setReadinessMap({});
        }
      })
      .catch((error) => {
        console.error("[Dashboard] initial load failed:", error);
        setUpcoming([]);
        setWindowStats({ window_7d: 0, window_14d: 0, window_30d: 0 });
        setHeatmap({ genres: [], venues: [] });
        setReadinessMap({});
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentEnv = localStorage.getItem("ticketbot-env") === "live" ? "live" : "test";
    setEnvironment(currentEnv);
  }, []);

  const loadChart = (eventId: number) => {
    setSelectedChart(eventId);
    getPriceHistory(eventId).then((data) => setChartData(data as PricePoint[]));
  };

  const handleLiveSync = async () => {
    setSyncingLive(true);
    setSyncMessage("");
    try {
      const summary = await syncLiveData({
        force: true,
        ttl_minutes: 30,
        max_pages: 5,
        days_ahead: 60,
        categories: ["concerts", "sports", "theater", "comedy", "family"],
      }) as {
        cached?: boolean;
        cache_age_minutes?: number;
        summary?: { totals?: { fetched?: number; inserted?: number; updated?: number; errors?: number } };
        totals?: { fetched?: number; inserted?: number; updated?: number; errors?: number };
        providers?: Array<{ provider: string; errors: string[] }>;
      };

      if (summary.cached) {
        const age = summary.cache_age_minutes ?? 0;
        setSyncMessage(`Using cached live data (${age}m old)`);
      }

      const totals = summary.totals || {};
      const fallbackTotals = summary.summary?.totals || {};
      const mergedTotals = Object.keys(totals).length ? totals : fallbackTotals;
      const providerErrors = (summary.providers || []).flatMap((provider) => provider.errors || []);
      if ((mergedTotals.inserted || 0) > 0 || (mergedTotals.updated || 0) > 0) {
        const baseMessage = `Synced ${mergedTotals.fetched || 0} events: +${mergedTotals.inserted || 0} inserted, ${mergedTotals.updated || 0} updated`;
        setSyncMessage(providerErrors.length > 0 ? `${baseMessage}. Note: ${providerErrors[0]}` : baseMessage);
      } else if (!summary.cached) {
        setSyncMessage(providerErrors[0] || "No live events were synced");
      }
      const [refreshed, quick] = await Promise.all([
        getUpcomingOpportunities({ min_roi: DEFAULT_MIN_ROI, min_confidence: DEFAULT_MIN_CONFIDENCE, upcoming_window: "7" }),
        getDashboardQuickView(),
      ]);
      const typed = refreshed as UpcomingResponse;
      const typedQuick = quick as QuickViewSnapshot;
      const opportunities = typed.opportunities || [];
      setUpcoming(opportunities);
      setWindowStats(typed.windows || { window_7d: 0, window_14d: 0, window_30d: 0 });
      setQuickView(typedQuick);
      if (opportunities.length > 0) {
        const ids = opportunities.map((entry) => entry.id);
        const readiness = await getBatchReadiness(ids) as ReadinessItem[];
        const map: Record<number, ReadinessItem> = {};
        readiness.forEach((item) => { map[item.event_id] = item; });
        setReadinessMap(map);
      } else {
        setReadinessMap({});
      }
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : "Live sync failed");
    } finally {
      setSyncingLive(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Music className="h-8 w-8 text-primary animate-bounce" />
        <p className="text-muted-foreground animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  // Count readiness statuses
  const goCount = Object.values(readinessMap).filter(r => r.readiness_status === "go").length;
  const partialCount = Object.values(readinessMap).filter(r => r.readiness_status === "partial").length;
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 p-6 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djZoLTJ2LTZoMnptMC0yMHYyaC0ydi0yaDJ6bTAtOHY0aC0ydi00aDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-5 w-5" />
            <span className="text-sm font-medium text-white/80">Control Tower + ROI Leaderboard</span>
          </div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-white/70 mt-1">Quick-view every workflow, then drill into events with the best modeled ROI</p>
          {environment === "live" && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={handleLiveSync} disabled={syncingLive}
                className="bg-white/15 border border-white/30 text-white hover:bg-white/20" variant="secondary">
                {syncingLive ? "Syncing live data..." : "Sync Live Data"}
              </Button>
              {syncMessage && <p className="text-xs text-white/85">{syncMessage}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="glow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><CalendarClock className="h-4 w-4 text-sky-500" /> Next 7d</div>
            <p className="text-3xl font-bold mt-1">{windowStats.window_7d}</p>
            <p className="text-xs text-muted-foreground">on-sale drops</p>
          </CardContent>
        </Card>
        <Card className="glow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><DollarSign className="h-4 w-4 text-green-500" /> Top ROI</div>
            <p className="text-3xl font-bold mt-1 text-green-500">{topRoiEvent?.estimated_roi || 0}%</p>
            <p className="text-xs text-muted-foreground">{topRoiEvent?.artist || "—"}</p>
          </CardContent>
        </Card>
        <Card className="glow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><CheckCircle className="h-4 w-4 text-green-500" /> Ready</div>
            <p className="text-3xl font-bold mt-1 text-green-500">{goCount}</p>
            <p className="text-xs text-muted-foreground">events go</p>
          </CardContent>
        </Card>
        <Card className="glow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" /> Partial</div>
            <p className="text-3xl font-bold mt-1 text-amber-500">{partialCount}</p>
            <p className="text-xs text-muted-foreground">need setup</p>
          </CardContent>
        </Card>
        <Card className="glow-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Ticket className="h-4 w-4 text-violet-500" /> 14d + 30d</div>
            <p className="text-3xl font-bold mt-1">{windowStats.window_14d + windowStats.window_30d}</p>
            <p className="text-xs text-muted-foreground">pipeline</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Workflow Quick View</h2>
          <p className="text-xs text-muted-foreground">One-click jump into each operational page</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Link href="/events">
            <Card className="glow-card hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase">Events</p>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-2">{quickView.events.on_sale_7d}</p>
                <p className="text-xs text-muted-foreground">on sale in 7d ({quickView.events.on_sale_60d} in 60d)</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/autobuy">
            <Card className="glow-card hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase">Autobuy</p>
                  <Ticket className="h-4 w-4 text-violet-500" />
                </div>
                <p className="text-2xl font-bold mt-2">{quickView.autobuy.enabled_rules}</p>
                <p className="text-xs text-muted-foreground">enabled rules ({quickView.autobuy.active_snipe_rules} active snipes)</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/accounts">
            <Card className="glow-card hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase">Accounts</p>
                  <Users className="h-4 w-4 text-cyan-500" />
                </div>
                <p className="text-2xl font-bold mt-2">{quickView.accounts.active_accounts}</p>
                <p className="text-xs text-muted-foreground">active across {quickView.accounts.active_platforms} platforms</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/sniper">
            <Card className="glow-card hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase">Sniper</p>
                  <Crosshair className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-2xl font-bold mt-2">{quickView.sniper.active_sessions}</p>
                <p className="text-xs text-muted-foreground">{quickView.sniper.needs_input} waiting for manual input</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/orders">
            <Card className="glow-card hover:shadow-lg transition-all duration-200 cursor-pointer h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground uppercase">Orders</p>
                  <ShoppingCart className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold mt-2">${quickView.orders.profit_30d}</p>
                <p className="text-xs text-muted-foreground">{quickView.orders.orders_30d} orders in last 30d</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="leaderboard" className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="leaderboard">ROI Leaderboard</TabsTrigger>
          <TabsTrigger value="on-sale">On-Sale Pipeline</TabsTrigger>
          <TabsTrigger value="prices">Price Trends</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
        </TabsList>

        {/* ROI Leaderboard - default tab */}
        <TabsContent value="leaderboard" className="space-y-2">
          {roiRanked.length === 0 && (
            <Card className="glow-card"><CardContent className="p-5 text-sm text-muted-foreground">No upcoming opportunities found.</CardContent></Card>
          )}
          {roiRanked.map((e, i) => {
            const r = readinessMap[e.id];
            return (
              <Link key={e.id} href={`/events/${e.id}`}>
                <Card className="glow-card hover:shadow-lg transition-all duration-200 cursor-pointer group">
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <span className="text-2xl font-bold text-muted-foreground/30 w-8 shrink-0">#{i + 1}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold group-hover:text-primary transition-colors truncate">{e.artist}</p>
                          <ReadinessIndicator readiness={r} />
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{e.name} &middot; {e.venue}</p>
                        <p className="text-xs text-muted-foreground">
                          On sale {new Date(e.on_sale_date).toLocaleDateString()} ({e.days_until_on_sale === 0 ? "today!" : `${e.days_until_on_sale}d`}) &middot; Event {new Date(e.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <DemandBadge score={e.demand_score} />
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-500">+{e.estimated_roi}%</p>
                        <p className="text-xs text-muted-foreground">
                          Entry {formatRange(e.projected_entry_range_low, e.projected_entry_range_high)} &middot; Resale {formatRange(e.projected_resale_range_low, e.projected_resale_range_high)}
                        </p>
                        <Badge variant="outline" className={`text-[10px] mt-0.5 ${
                          e.roi_confidence === "high" ? "text-emerald-500 border-emerald-500/30" :
                          e.roi_confidence === "medium" ? "text-amber-500 border-amber-500/30" :
                          "text-muted-foreground"
                        }`}>
                          {e.roi_confidence} ROI &middot; {priceStatusLabel(e.price_estimate_status)}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </TabsContent>

        {/* On-Sale Pipeline */}
        <TabsContent value="on-sale" className="space-y-3">
          {upcoming.length === 0 && (
            <Card className="glow-card"><CardContent className="p-5 text-sm text-muted-foreground">No upcoming opportunities found.</CardContent></Card>
          )}
          {upcoming.map((e, i) => {
            const r = readinessMap[e.id];
            return (
              <Link key={e.id} href={`/events/${e.id}`}>
                <Card className="glow-card hover:shadow-lg transition-all duration-200 cursor-pointer mb-3 group">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-muted-foreground/30 w-8">#{i + 1}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold group-hover:text-primary transition-colors">{e.artist}</p>
                          <ReadinessIndicator readiness={r} />
                        </div>
                        <p className="text-sm text-muted-foreground">{e.name} &middot; {e.venue}</p>
                        <p className="text-xs text-muted-foreground">
                          On sale {new Date(e.on_sale_date).toLocaleDateString()} ({e.days_until_on_sale === 0 ? "today" : `in ${e.days_until_on_sale}d`}) &middot; Event {new Date(e.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <DemandBadge score={e.demand_score} />
                      <div className="text-right">
                        <Badge variant="outline" className="mb-1">{e.on_sale_window}</Badge>
                        <p className="text-sm font-bold">+{e.estimated_roi}% ROI</p>
                        <p className="text-xs text-muted-foreground">
                          Entry {formatRange(e.projected_entry_range_low, e.projected_entry_range_high)} &middot; Resale {formatRange(e.projected_resale_range_low, e.projected_resale_range_high)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{e.roi_confidence} ROI confidence &middot; {priceStatusLabel(e.price_estimate_status)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </TabsContent>

        <TabsContent value="prices">
          <Card className="glow-card">
            <CardContent className="p-4">
              <div className="flex gap-2 flex-wrap mb-4">
                {upcoming.slice(0, 6).map((e) => (
                  <Badge key={e.id} variant={selectedChart === e.id ? "default" : "outline"}
                    className={`cursor-pointer transition-all ${selectedChart === e.id ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 border-0" : ""}`}
                    onClick={() => loadChart(e.id)}>
                    {e.artist}
                  </Badge>
                ))}
              </div>
              {chartData.length > 0 && <PriceChart data={chartData} height={350} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="glow-card">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Music className="h-4 w-4 text-primary" /> Genre Performance</h3>
                <div className="space-y-2">
                  {heatmap.genres.map((g) => (
                    <div key={g.genre} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div><p className="font-medium text-sm">{g.genre}</p><p className="text-xs text-muted-foreground">{g.event_count} events</p></div>
                      <div className="text-right"><p className="text-sm font-bold text-green-500">{g.avg_roi}% avg ROI</p><DemandBadge score={g.avg_demand} /></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="glow-card">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Top Venues</h3>
                <div className="space-y-2">
                  {heatmap.venues.map((v) => (
                    <div key={v.venue} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div><p className="font-medium text-sm">{v.venue}</p><p className="text-xs text-muted-foreground">{v.city}</p></div>
                      <div className="text-right"><p className="text-sm font-bold">${v.avg_max_price} avg</p><DemandBadge score={v.avg_demand} /></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
