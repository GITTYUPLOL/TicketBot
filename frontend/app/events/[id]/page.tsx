"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PriceChart from "@/components/PriceChart";
import DemandBadge from "@/components/DemandBadge";
import { getEvent, getTickets, getPriceHistory, getBestTimeToBuy, purchaseTicket, getEventReadiness } from "@/lib/api";
import { Calendar, MapPin, Clock, TrendingUp, TrendingDown, ShoppingCart, Star, ArrowUp, Music, CheckCircle, XCircle, AlertTriangle, CreditCard, Users, Crosshair, Globe, ExternalLink } from "lucide-react";

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [bestTime, setBestTime] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getEvent(id as string),
      getTickets(id as string),
      getPriceHistory(id as string),
      getBestTimeToBuy(id as string),
      getEventReadiness(id as string).catch(() => null),
    ])
      .then(([e, t, ph, bt, rd]) => {
        setEvent(e);
        setTickets(t);
        setPriceHistory(ph);
        setBestTime(bt);
        setReadiness(rd);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePurchase = async (ticketId: number) => {
    setPurchasing(ticketId);
    try {
      const result = await purchaseTicket(ticketId, { quantity: 1 });
      setPurchaseResult(result);
    } catch (err) {
      setPurchaseResult({ error: "Purchase failed" });
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return <div className="flex flex-col items-center justify-center h-96 gap-3"><Music className="h-8 w-8 text-primary animate-bounce" /><p className="text-muted-foreground animate-pulse">Loading event...</p></div>;
  }
  if (!event) {
    return <div className="text-center py-12 text-muted-foreground">Event not found</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 p-6 text-white">
        <div className="absolute top-2 right-4 text-white/10"><Music className="h-24 w-24" /></div>
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/20">{event.genre}</Badge>
            {event.trending && (
              <Badge className="bg-white/20 text-white border-white/20" variant="outline">
                <TrendingUp className="h-3 w-3 mr-1" /> Trending
              </Badge>
            )}
            <DemandBadge score={event.demand_score} />
          </div>
          <h1 className="text-2xl font-bold">{event.artist}</h1>
          <p className="text-lg text-white/80">{event.name}</p>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-white/70">
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{event.venue}, {event.city}</span>
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{new Date(event.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{event.time}</span>
          </div>
        </div>
      </div>

      {/* Price overview row */}
      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="glow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Face Value</p>
            <p className="text-2xl font-bold mt-1">${event.face_value}</p>
          </CardContent>
        </Card>
        <Card className="glow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Expected Entry Range</p>
            <p className="text-2xl font-bold mt-1">${event.min_price}</p>
            <p className="text-xs text-muted-foreground mt-1">Current low ask estimate</p>
          </CardContent>
        </Card>
        <Card className="glow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Expected Resale Range</p>
            <p className="text-2xl font-bold text-green-600 mt-1">${event.min_price} - ${event.max_price}</p>
            <p className="text-xs text-green-500 mt-1 font-semibold">+{event.resale_potential}% potential ROI</p>
          </CardContent>
        </Card>
      </div>

      {/* Purchase result toast */}
      {purchaseResult && (
        <Card className={purchaseResult.error ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}>
          <CardContent className="p-4">
            {purchaseResult.error ? (
              <p className="text-red-600">{purchaseResult.error}</p>
            ) : (
              <div>
                <p className="font-semibold text-green-700">Purchase Successful!</p>
                <p className="text-sm text-green-600">Order #{purchaseResult.order_id} &middot; Total: ${purchaseResult.total} &middot; Card: {purchaseResult.card_used}</p>
                <p className="text-sm text-green-600">Estimated resale: ${purchaseResult.resale_value} (profit: ${purchaseResult.estimated_profit})</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Price Chart */}
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Price History (30 Days)</h3>
              <PriceChart data={priceHistory} height={300} />
            </CardContent>
          </Card>
        </div>

        {/* Best Time + Info */}
        <div className="space-y-4">
          {bestTime && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">Best Time to Buy</h3>
                <div className="flex items-center gap-2 mb-2">
                  {bestTime.trend === "rising" ? (
                    <TrendingUp className="h-5 w-5 text-red-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-green-500" />
                  )}
                  <span className={`font-medium ${bestTime.trend === "rising" ? "text-red-500" : "text-green-500"}`}>
                    Prices {bestTime.trend}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{bestTime.recommendation}</p>
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground">Current avg: ${bestTime.current_avg}</p>
                <p className="text-xs text-muted-foreground">Lowest seen: ${bestTime.lowest_price} on {bestTime.lowest_date}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-2">Quick Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Listings</span><span className="font-medium">{tickets.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Demand Score</span><span className="font-medium">{event.demand_score}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sources</span><span className="font-medium">{[...new Set(tickets.map((t: any) => t.source))].length}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Snipe Readiness Checklist */}
      {readiness && (
        <Card className="border-2" style={{ borderColor: readiness.readiness_status === 'go' ? 'var(--color-green-500)' : readiness.readiness_status === 'partial' ? 'var(--color-yellow-500)' : 'var(--color-red-500)' }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-lg">Snipe Readiness</h3>
                <ReadinessStatusBadge status={readiness.readiness_status} score={readiness.readiness_score} />
              </div>
              {readiness.on_sale_date && (
                <div className="text-sm text-muted-foreground">
                  On sale: {new Date(readiness.on_sale_date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {/* Accounts Check */}
              <ReadinessCheck
                label="Accounts Linked"
                icon={<Users className="h-4 w-4" />}
                pass={readiness.checks.accounts_linked.pass}
                detail={readiness.checks.accounts_linked.detail}
                actionLabel="Link Accounts"
                onAction={() => router.push('/accounts')}
              />

              {/* Payment Card Check */}
              <ReadinessCheck
                label="Payment Card"
                icon={<CreditCard className="h-4 w-4" />}
                pass={readiness.checks.payment_card.pass}
                detail={readiness.checks.payment_card.detail}
                actionLabel="Add Card"
                onAction={() => router.push('/profile')}
              />

              {/* Autobuy Rule Check */}
              <ReadinessCheck
                label="Autobuy / Snipe Rule"
                icon={<Crosshair className="h-4 w-4" />}
                pass={readiness.checks.autobuy_rule.pass}
                detail={readiness.checks.autobuy_rule.detail}
                actionLabel="Create Rule"
                onAction={() => router.push('/autobuy')}
              />

              {/* Selectors Cached Check */}
              <ReadinessCheck
                label="Selectors Cached"
                icon={<Globe className="h-4 w-4" />}
                pass={readiness.checks.selectors_cached.pass}
                detail={readiness.checks.selectors_cached.detail}
              />
            </div>

            {/* Platform Account Breakdown */}
            {readiness.accounts_by_platform && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">Accounts by Platform</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(readiness.accounts_by_platform).map(([platform, count]: [string, any]) => (
                    <Badge key={platform} variant="outline" className={count > 0 ? 'border-green-300 bg-green-500/10 text-green-700 dark:text-green-400' : 'text-muted-foreground'}>
                      {platform}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historical Comparables / ROI Context */}
      {readiness?.comparables?.available && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Historical Comparables</h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {readiness.comparables.confidence} confidence
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {readiness.comparables.sample_size} comps ({readiness.comparables.match_type} match)
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Projected Resale</p>
                <p className="text-xl font-bold text-green-600">${readiness.comparables.projected_resale}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Avg Historical ROI</p>
                <p className="text-xl font-bold text-green-600">+{readiness.comparables.avg_historical_roi}%</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className={`text-xl font-bold ${readiness.comparables.confidence === 'high' ? 'text-green-600' : readiness.comparables.confidence === 'medium' ? 'text-yellow-600' : 'text-red-500'}`}>
                  {readiness.comparables.confidence === 'high' ? 'HIGH' : readiness.comparables.confidence === 'medium' ? 'MED' : 'LOW'}
                </p>
              </div>
            </div>

            {readiness.comparables.comparables?.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artist</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Face Value</TableHead>
                      <TableHead>Avg Resale</TableHead>
                      <TableHead>ROI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readiness.comparables.comparables.map((comp: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{comp.artist}</TableCell>
                        <TableCell className="text-muted-foreground">{comp.venue}</TableCell>
                        <TableCell className="text-muted-foreground">{comp.event_date}</TableCell>
                        <TableCell>${comp.face_value}</TableCell>
                        <TableCell className="text-green-600 font-medium">${comp.avg_resale_price}</TableCell>
                        <TableCell className="font-semibold text-green-600">+{comp.roi_actual}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ticket Listings */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3">Ticket Listings ({tickets.length})</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Row</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Fees</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.source}</TableCell>
                    <TableCell>{t.section}</TableCell>
                    <TableCell>{t.row}</TableCell>
                    <TableCell className="font-semibold">${t.price}</TableCell>
                    <TableCell className="text-muted-foreground">+${t.fees}</TableCell>
                    <TableCell>{t.quantity}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {t.is_best_deal ? <Badge className="bg-green-500/15 text-green-600 border-green-200 text-xs" variant="outline"><Star className="h-3 w-3 mr-1" />Best Deal</Badge> : null}
                        {t.is_highest_resale ? <Badge className="bg-purple-500/15 text-purple-600 border-purple-200 text-xs" variant="outline"><ArrowUp className="h-3 w-3 mr-1" />Top Resale</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handlePurchase(t.id)}
                        disabled={purchasing === t.id}
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" />
                        {purchasing === t.id ? "..." : "Buy"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadinessStatusBadge({ status, score }: { status: string; score: number }) {
  const config = {
    go: { icon: CheckCircle, label: "GO", color: "text-green-700 dark:text-green-400", bg: "bg-green-500/15 border-green-300" },
    partial: { icon: AlertTriangle, label: "PARTIAL", color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-500/15 border-yellow-300" },
    not_ready: { icon: XCircle, label: "NOT READY", color: "text-red-700 dark:text-red-400", bg: "bg-red-500/15 border-red-300" },
  }[status] || { icon: XCircle, label: "UNKNOWN", color: "text-muted-foreground", bg: "bg-muted" };

  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.bg} ${config.color} text-xs font-bold px-3 py-1`}>
      <Icon className="h-3.5 w-3.5 mr-1" /> {config.label} — {score}%
    </Badge>
  );
}

function ReadinessCheck({ label, icon, pass, detail, actionLabel, onAction }: {
  label: string; icon: React.ReactNode; pass: boolean; detail: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${pass ? 'border-green-200 bg-green-500/5 dark:border-green-800 dark:bg-green-500/10' : 'border-red-200 bg-red-500/5 dark:border-red-800 dark:bg-red-500/10'}`}>
      {pass ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" /> : <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {icon} {label}
        </div>
        <p className="text-xs text-muted-foreground truncate">{detail}</p>
      </div>
      {!pass && actionLabel && onAction && (
        <Button size="sm" variant="outline" className="shrink-0 text-xs h-7" onClick={onAction}>
          {actionLabel} <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      )}
    </div>
  );
}
