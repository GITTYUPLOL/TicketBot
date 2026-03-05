"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EventCard from "@/components/EventCard";
import { getEvents, getGenres } from "@/lib/api";
import { Search, Music } from "lucide-react";

interface EventListItem {
  id: number;
  name: string;
  artist: string;
  venue: string;
  city: string;
  date: string;
  genre: string;
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

export default function EventsPage() {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [sort, setSort] = useState("on_sale");
  const [upcomingWindow, setUpcomingWindow] = useState("7");
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { sort };
    if (search) params.search = search;
    if (genre && genre !== "all") params.genre = genre;
    if (upcomingWindow !== "all") params.upcoming_window = upcomingWindow;
    getEvents(params).then((data) => setEvents(data as EventListItem[])).finally(() => setLoading(false));
  }, [genre, search, sort, upcomingWindow]);

  useEffect(() => {
    getGenres().then(setGenres);
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchEvents, 300);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 p-6 text-white">
        <div className="absolute top-2 right-4 text-white/10">
          <Music className="h-24 w-24" />
        </div>
        <div className="relative">
          <h1 className="text-2xl font-bold">Upcoming On-Sale Opportunities</h1>
          <p className="text-sm text-white/70 mt-1">Prioritized by 7-day, then 14-day, then 30-day windows with ROI context</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search artists, venues, cities..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={genre} onValueChange={setGenre}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Genre" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            {genres.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={upcomingWindow} onValueChange={setUpcomingWindow}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="On-sale window" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">On Sale: Next 7d</SelectItem>
            <SelectItem value="14">On Sale: Next 14d</SelectItem>
            <SelectItem value="30">On Sale: Next 30d</SelectItem>
            <SelectItem value="all">All Events</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="on_sale">On-Sale Soonest</SelectItem>
            <SelectItem value="roi">Highest ROI</SelectItem>
            <SelectItem value="demand">Highest Demand</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
            <SelectItem value="date">Date: Soonest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Music className="h-8 w-8 text-primary animate-bounce" />
          <p className="text-muted-foreground animate-pulse">Loading events...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No upcoming opportunities found for this window. Try 14d or 30d.
        </div>
      )}
    </div>
  );
}
