"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  events: { id: number; name: string; artist: string }[];
  cards: { id: number; name: string; last_four: string }[];
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

export default function AutobuyRuleForm({ events, cards, onSubmit, onCancel }: Props) {
  const [mode, setMode] = useState("alert");
  const [eventId, setEventId] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [section, setSection] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [cardId, setCardId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedEvent = events.find((ev) => ev.id === Number(eventId));
    onSubmit({
      event_id: Number(eventId) || null,
      event_name: selectedEvent?.name || "",
      mode,
      max_price: maxPrice ? Number(maxPrice) : null,
      target_price: targetPrice ? Number(targetPrice) : null,
      section_filter: section || null,
      quantity: Number(quantity),
      card_id: cardId ? Number(cardId) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Mode</Label>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alert">Price Alert + One-Click</SelectItem>
            <SelectItem value="auto">Full Auto Purchase</SelectItem>
            <SelectItem value="snipe">Snipe (On-Sale Drop)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Event</Label>
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger><SelectValue placeholder="Select event..." /></SelectTrigger>
          <SelectContent>
            {events.map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>{e.artist} - {e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {mode === "alert" ? (
          <div>
            <Label>Target Price ($)</Label>
            <Input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="150" />
          </div>
        ) : (
          <div>
            <Label>Max Price ($)</Label>
            <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="400" />
          </div>
        )}
        <div>
          <Label>Quantity</Label>
          <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} min="1" max="10" />
        </div>
      </div>

      <div>
        <Label>Section Filter (optional)</Label>
        <Input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Floor, GA, VIP..." />
      </div>

      <div>
        <Label>Payment Card</Label>
        <Select value={cardId} onValueChange={setCardId}>
          <SelectTrigger><SelectValue placeholder="Default card" /></SelectTrigger>
          <SelectContent>
            {cards.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name} (****{c.last_four})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">Create Rule</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
