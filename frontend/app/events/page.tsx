"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EventCard from "@/components/EventCard";
import { Button } from "@/components/ui/button";
import { getEvents, getGenres, syncLiveData } from "@/lib/api";
import { Search, Music, RefreshCw } from "lucide-react";

const DEFAULT_MIN_ROI = "25";
const DEFAULT_MIN_CONFIDENCE = "medium";

interface EventListItem {
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

function prettyCategory(value: string) {
  if (value === "concerts") return "Concerts";
  if (value === "sports") return "Sports";
  if (value === "theater") return "Theater";
  if (value === "comedy") return "Comedy";
  if (value === "family") return "Family";
  if (value === "festivals") return "Festivals";
  if (value === "other") return "Other";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function inferCategoryFromGenre(genre: string) {
  const normalized = String(genre || "").toLowerCase();
  if (!normalized) return "other";
  if (normalized.includes("comedy")) return "comedy";
  if (normalized.includes("theater") || normalized.includes("theatre") || normalized.includes("broadway")) return "theater";
  if (normalized.includes("sport") || normalized.includes("boxing") || normalized.includes("mma") || normalized.includes("ufc") || normalized.includes("fighting")) return "sports";
  if (normalized.includes("family")) return "family";
  if (normalized.includes("festival")) return "festivals";
  if (
    normalized.includes("music")
    || normalized.includes("rock")
    || normalized.includes("pop")
    || normalized.includes("hip-hop")
    || normalized.includes("country")
    || normalized.includes("latin")
    || normalized.includes("electronic")
  ) return "concerts";
  return "other";
}

function collectFilterOptions(items: EventListItem[]) {
  const categories = [...new Set(items.map((item) => item.category || inferCategoryFromGenre(item.genre)).filter(Boolean))].sort();
  const leagues = [...new Set(items.map((item) => item.league).filter((value): value is string => Boolean(value)))].sort();
  const countries = [...new Set(items.map((item) => item.country_code).filter((value): value is string => Boolean(value)))].sort();
  return { categories, leagues, countries };
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [leagues, setLeagues] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [category, setCategory] = useState("all");
  const [league, setLeague] = useState("all");
  const [country, setCountry] = useState("all");
  const [sourceMarket, setSourceMarket] = useState("all");
  const [sort, setSort] = useState("on_sale");
  const [upcomingWindow, setUpcomingWindow] = useState("7");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [environment, setEnvironment] = useState<"live" | "test">("test");

  const fetchEvents = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {
      sort,
      min_roi: DEFAULT_MIN_ROI,
      min_confidence: DEFAULT_MIN_CONFIDENCE,
    };

    if (search) params.search = search;
    if (genre && genre !== "all") params.genre = genre;
    if (category !== "all") params.category = category;
    if (league !== "all") params.league = league;
    if (country !== "all") params.country = country;
    if (sourceMarket !== "all") params.source_market = sourceMarket;
    if (upcomingWindow !== "all") params.upcoming_window = upcomingWindow;

    getEvents(params)
      .then((data) => {
        const typed = data as EventListItem[];
        setEvents(typed);
      })
      .catch((err) => {
        console.error("[Events] fetch failed:", err);
        setError(String(err));
      })
      .finally(() => setLoading(false));
  }, [category, country, genre, league, search, sort, sourceMarket, upcomingWindow]);

  useEffect(() => {
    Promise.all([
      getGenres(),
      getEvents({
        sort: "demand",
        limit: "250",
        upcoming_window: "30",
        min_roi: DEFAULT_MIN_ROI,
        min_confidence: DEFAULT_MIN_CONFIDENCE,
      }),
    ])
      .then(([genrePayload, snapshotPayload]) => {
        const snapshot = snapshotPayload as EventListItem[];
        const options = collectFilterOptions(snapshot);
        setCategories(options.categories);
        setLeagues(options.leagues);
        setCountries(options.countries);

        const genreList = (genrePayload as string[]) || [];
        setGenres(genreList);
      })
      .catch(() => {
        setCategories([]);
        setLeagues([]);
        setCountries([]);
      });

    if (typeof window !== "undefined") {
      const env = localStorage.getItem("ticketbot-env") === "live" ? "live" : "test";
      setEnvironment(env);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchEvents, 300);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  const handleLiveSync = async () => {
    if (environment !== "live") {
      setRefreshMessage("Live sync is only available in LIVE mode.");
      return;
    }

    setRefreshing(true);
    setRefreshMessage("");
    try {
      const response = await syncLiveData({
        ttl_minutes: 30,
        max_pages: 12,
        days_ahead: 60,
        categories: ["concerts", "sports", "theater", "comedy", "family"],
      }) as {
        cached?: boolean;
        cache_age_minutes?: number;
        summary?: { totals?: { fetched?: number; inserted?: number; updated?: number } };
        totals?: { fetched?: number; inserted?: number; updated?: number };
      };

      if (response.cached) {
        const age = response.cache_age_minutes ?? 0;
        setRefreshMessage(`Using cached live data (${age}m old)`);
      } else {
        const totals = response.totals || response.summary?.totals || {};
        setRefreshMessage(`Synced ${totals.fetched || 0} events (+${totals.inserted || 0} new, ${totals.updated || 0} updated)`);
      }

      await fetchEvents();
    } catch (syncError) {
      setRefreshMessage(syncError instanceof Error ? syncError.message : "Live sync failed");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 p-6 text-white">
        <div className="absolute top-2 right-4 text-white/10">
          <Music className="h-24 w-24" />
        </div>
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Upcoming Opportunities</h1>
            <p className="text-sm text-white/70 mt-1">
              Global pipeline across concerts, sports, boxing, MMA, theater, comedy and more
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/20 text-white hover:bg-white/30 border-white/20"
            disabled={refreshing}
            onClick={handleLiveSync}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Syncing..." : "Sync Live (Cached)"}
          </Button>
        </div>
        {refreshMessage && <p className="relative mt-2 text-xs text-white/85">{refreshMessage}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8 gap-3">
        <div className="relative sm:col-span-2 xl:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search artists, venues, cities..."
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((item) => (
              <SelectItem key={item} value={item}>{prettyCategory(item)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={genre} onValueChange={setGenre}>
          <SelectTrigger><SelectValue placeholder="Genre" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            {genres.map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={league} onValueChange={setLeague}>
          <SelectTrigger><SelectValue placeholder="League" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Leagues</SelectItem>
            {leagues.map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {countries.map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={upcomingWindow} onValueChange={setUpcomingWindow}>
          <SelectTrigger><SelectValue placeholder="On-sale window" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">On Sale: Next 7d</SelectItem>
            <SelectItem value="14">On Sale: Next 14d</SelectItem>
            <SelectItem value="30">On Sale: Next 30d</SelectItem>
            <SelectItem value="all">All Windows</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="on_sale">On-Sale Soonest</SelectItem>
            <SelectItem value="roi">Highest ROI</SelectItem>
            <SelectItem value="demand">Highest Demand</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={sourceMarket === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setSourceMarket("all")}
        >
          All Markets
        </Button>
        <Button
          variant={sourceMarket === "primary" ? "default" : "outline"}
          size="sm"
          onClick={() => setSourceMarket("primary")}
        >
          Primary
        </Button>
        <Button
          variant={sourceMarket === "resale" ? "default" : "outline"}
          size="sm"
          onClick={() => setSourceMarket("resale")}
        >
          Resale
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Music className="h-8 w-8 text-primary animate-bounce" />
          <p className="text-muted-foreground animate-pulse">Loading events...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-4 text-red-500 bg-red-500/10 rounded-lg p-4">
          <p className="font-semibold">Fetch error:</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No opportunities found for this filter set. Try another region/window.
        </div>
      )}
    </div>
  );
}
