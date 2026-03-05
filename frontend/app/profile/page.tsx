"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import PaymentCardForm from "@/components/PaymentCardForm";
import { getCards, addCard, setDefaultCard, deleteCard, getOrderStats } from "@/lib/api";
import { CreditCard, Plus, Star, Trash2, User } from "lucide-react";

export default function ProfilePage() {
  const [cards, setCards] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = () => getCards().then(setCards);

  useEffect(() => {
    Promise.all([getCards(), getOrderStats()])
      .then(([c, s]) => { setCards(c); setStats(s); })
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (data: Record<string, unknown>) => {
    await addCard(data);
    setDialogOpen(false);
    refresh();
  };

  const handleDefault = async (id: number) => {
    await setDefaultCard(id);
    refresh();
  };

  const handleDelete = async (id: number) => {
    await deleteCard(id);
    refresh();
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;

  const cardTypeColors: Record<string, string> = {
    visa: "bg-blue-500",
    mastercard: "bg-orange-500",
    amex: "bg-green-600",
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      {/* User info */}
      <Card>
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Ticket Scalper Pro</h2>
            <p className="text-sm text-muted-foreground">Member since 2024</p>
            {stats && (
              <div className="flex gap-4 mt-2 text-sm">
                <span>{stats.total_orders} orders</span>
                <span className="text-green-600">${stats.total_profit?.toLocaleString()} profit</span>
                <span>{stats.total_orders > 0 ? Math.round((stats.profitable_count / stats.total_orders) * 100) : 0}% win rate</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment cards */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Payment Cards</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Card</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Payment Card</DialogTitle></DialogHeader>
            <PaymentCardForm onSubmit={handleAdd} onCancel={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {cards.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-14 rounded ${cardTypeColors[c.card_type] || "bg-gray-500"} flex items-center justify-center`}>
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{c.name}</p>
                    {c.is_default ? <Badge variant="secondary" className="text-xs"><Star className="h-3 w-3 mr-1" />Default</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{c.card_type.toUpperCase()} ****{c.last_four} &middot; Exp {c.expiry}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {!c.is_default && (
                  <Button variant="outline" size="sm" onClick={() => handleDefault(c.id)}>Set Default</Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {cards.length === 0 && (
          <p className="text-center text-muted-foreground py-6">No payment cards saved.</p>
        )}
      </div>
    </div>
  );
}
