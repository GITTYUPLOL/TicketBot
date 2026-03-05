"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DemandBadge from "./DemandBadge";
import { Calendar, MapPin, TrendingUp, Ticket } from "lucide-react";

interface Event {
  id: number;
  name: string;
  artist: string;
  venue: string;
  city: string;
  country_code?: string | null;
  date: string;
  genre: string;
  category?: string | null;
  league?: string | null;
  source_market?: string | null;
  min_price: number;
  max_price: number;
  face_value: number;
  demand_score: number;
  trending: boolean;
  resale_potential: number;
  on_sale_date?: string | null;
  days_until_on_sale?: number | null;
  estimated_roi?: number;
  roi_confidence?: "high" | "medium" | "low";
}

const genreGradients: Record<string, string> = {
  Pop: "from-fuchsia-500/20 to-pink-500/10",
  Rock: "from-orange-500/20 to-red-500/10",
  "Hip-Hop": "from-violet-500/20 to-purple-500/10",
  "R&B": "from-blue-500/20 to-indigo-500/10",
  Country: "from-amber-500/20 to-yellow-500/10",
  Latin: "from-green-500/20 to-emerald-500/10",
  Sports: "from-emerald-500/20 to-green-500/10",
  Fighting: "from-red-600/20 to-orange-500/10",
  Comedy: "from-yellow-500/20 to-amber-500/10",
  Theater: "from-rose-500/20 to-pink-500/10",
  Festival: "from-cyan-500/20 to-teal-500/10",
  Electronic: "from-indigo-500/20 to-blue-500/10",
  Other: "from-slate-500/20 to-gray-500/10",
};

export default function EventCard({ event }: { event: Event }) {
  const gradient = genreGradients[event.genre] || "from-fuchsia-500/20 to-violet-500/10";
  const category = event.category || "other";
  const categoryLabel =
    category === "concerts" ? "Concerts" :
    category === "sports" ? "Sports" :
    category === "theater" ? "Theater" :
    category === "comedy" ? "Comedy" :
    category === "family" ? "Family" :
    category === "festivals" ? "Festivals" :
    "Other";
  const sourceMarket = event.source_market || "primary";
  const onSaleLabel =
    event.days_until_on_sale === 0
      ? "on sale today"
      : typeof event.days_until_on_sale === "number" && event.days_until_on_sale > 0
        ? `on sale in ${event.days_until_on_sale}d`
        : null;
  const roi = typeof event.estimated_roi === "number" ? event.estimated_roi : event.resale_potential;
  const roiClass = roi >= 0 ? "text-green-500" : "text-red-500";
  const confidenceClass =
    event.roi_confidence === "high"
      ? "text-emerald-600"
      : event.roi_confidence === "medium"
        ? "text-amber-600"
        : "text-muted-foreground";

  return (
    <Link href={`/events/${event.id}`}>
      <Card className="glow-card hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full overflow-hidden group">
        {/* Genre gradient strip */}
        <div className={`h-1 bg-gradient-to-r ${gradient.replace('/20', '').replace('/10', '')}`} />
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2 gap-1">
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="text-xs">{categoryLabel}</Badge>
              {event.league && <Badge variant="outline" className="text-xs">{event.league}</Badge>}
              {event.country_code && <Badge variant="outline" className="text-xs">{event.country_code}</Badge>}
              <Badge variant="outline" className="text-xs uppercase">{sourceMarket}</Badge>
            </div>
            <div>
              {event.trending && (
                <Badge className="bg-orange-500/15 text-orange-500 border-orange-300/30 text-xs gap-1" variant="outline">
                  <TrendingUp className="h-3 w-3" />
                  Trending
                </Badge>
              )}
            </div>
          </div>

          <h3 className="font-bold text-base mt-2 line-clamp-1 group-hover:text-primary transition-colors">{event.artist}</h3>
          <p className="text-sm text-muted-foreground line-clamp-1">{event.name}</p>

          <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="line-clamp-1">{event.venue}, {event.city}</span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
          {event.on_sale_date && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>
                On sale {new Date(event.on_sale_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {onSaleLabel ? ` (${onSaleLabel})` : ""}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Ticket className="h-3 w-3" /> Price Range</p>
              <p className="text-sm font-bold">${event.min_price} - ${event.max_price}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <DemandBadge score={event.demand_score} />
              <span className={`text-xs font-semibold ${roiClass}`}>{roi >= 0 ? "+" : ""}{roi}% ROI</span>
              {event.roi_confidence && (
                <span className={`text-[10px] uppercase tracking-wide font-semibold ${confidenceClass}`}>
                  {event.roi_confidence} confidence
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
