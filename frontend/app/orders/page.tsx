"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrders, getOrderStats } from "@/lib/api";
import { DollarSign, TrendingUp, TrendingDown, ShoppingBag } from "lucide-react";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getOrders(), getOrderStats()])
      .then(([o, s]) => { setOrders(o); setStats(s); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Order History</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><ShoppingBag className="h-4 w-4" /> Total Orders</div>
              <p className="text-2xl font-bold mt-1">{stats.total_orders}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><DollarSign className="h-4 w-4" /> Total Spent</div>
              <p className="text-2xl font-bold mt-1">${stats.total_spent?.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><TrendingUp className="h-4 w-4" /> Total Profit</div>
              <p className="text-2xl font-bold mt-1 text-green-600">${stats.total_profit?.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><TrendingDown className="h-4 w-4" /> Win Rate</div>
              <p className="text-2xl font-bold mt-1">{stats.total_orders > 0 ? Math.round((stats.profitable_count / stats.total_orders) * 100) : 0}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Resale</TableHead>
                    <TableHead>P/L</TableHead>
                    <TableHead>Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-sm">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{o.artist}</p>
                        <p className="text-xs text-muted-foreground">{o.event_name}</p>
                      </TableCell>
                      <TableCell className="text-sm">{o.source}</TableCell>
                      <TableCell>{o.quantity}</TableCell>
                      <TableCell className="text-sm">${o.price_paid}</TableCell>
                      <TableCell className="font-medium">${o.total}</TableCell>
                      <TableCell className="text-sm">${o.resale_value || "-"}</TableCell>
                      <TableCell>
                        {o.profit != null && (
                          <span className={`font-medium text-sm ${o.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {o.profit >= 0 ? "+" : ""}${o.profit}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{o.purchased_via}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
