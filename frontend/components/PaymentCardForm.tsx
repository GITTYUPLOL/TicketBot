"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

export default function PaymentCardForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cardType, setCardType] = useState("visa");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, last_four: lastFour, expiry, card_type: cardType, is_default: false });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Card Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Visa Card" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Last 4 Digits</Label>
          <Input value={lastFour} onChange={(e) => setLastFour(e.target.value)} placeholder="4242" maxLength={4} pattern="[0-9]{4}" required />
        </div>
        <div>
          <Label>Expiry</Label>
          <Input value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="MM/YY" maxLength={5} required />
        </div>
      </div>
      <div>
        <Label>Card Type</Label>
        <Select value={cardType} onValueChange={setCardType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="visa">Visa</SelectItem>
            <SelectItem value="mastercard">Mastercard</SelectItem>
            <SelectItem value="amex">American Express</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1">Add Card</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
