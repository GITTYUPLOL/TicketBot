"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AutobuyRuleForm from "@/components/AutobuyRuleForm";
import { getAutobuyRules, createAutobuyRule, updateAutobuyRule, deleteAutobuyRule, getEvents, getCards } from "@/lib/api";
import { Plus, Trash2, Zap, Bell, Crosshair } from "lucide-react";

const modeIcons: Record<string, any> = { alert: Bell, auto: Zap, snipe: Crosshair };
const modeLabels: Record<string, string> = { alert: "Price Alert", auto: "Full Auto", snipe: "Snipe" };

export default function AutobuyPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = () => getAutobuyRules().then(setRules);

  useEffect(() => {
    Promise.all([getAutobuyRules(), getEvents(), getCards()])
      .then(([r, e, c]) => { setRules(r); setEvents(e); setCards(c); })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (data: Record<string, unknown>) => {
    await createAutobuyRule(data);
    setDialogOpen(false);
    refresh();
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    await updateAutobuyRule(id, { enabled: !enabled });
    refresh();
  };

  const handleDelete = async (id: number) => {
    await deleteAutobuyRule(id);
    refresh();
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Autobuy Rules</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Autobuy Rule</DialogTitle></DialogHeader>
            <AutobuyRuleForm events={events} cards={cards} onSubmit={handleCreate} onCancel={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Mode descriptions */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { mode: "alert", desc: "Set a target price and get notified when it drops. One-click buy." },
          { mode: "auto", desc: "Set criteria and the bot auto-purchases when matched." },
          { mode: "snipe", desc: "Auto-attempt purchase at the exact on-sale drop time." },
        ].map((m) => {
          const Icon = modeIcons[m.mode];
          return (
            <Card key={m.mode}>
              <CardContent className="p-3 flex items-start gap-3">
                <Icon className="h-5 w-5 mt-0.5 text-primary" />
                <div>
                  <p className="font-medium text-sm">{modeLabels[m.mode]}</p>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Rules table */}
      <Card>
        <CardContent className="p-4">
          {rules.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No autobuy rules yet. Create one to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Enabled</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Criteria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Log</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r: any) => {
                    const Icon = modeIcons[r.mode] || Zap;
                    const lastLog = r.execution_log?.[r.execution_log.length - 1];
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Switch checked={r.enabled} onCheckedChange={() => handleToggle(r.id, r.enabled)} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1"><Icon className="h-3 w-3" />{modeLabels[r.mode]}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{r.artist || r.event_name || "Any"}</p>
                            {r.venue && <p className="text-xs text-muted-foreground">{r.venue}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.max_price && <span>Max: ${r.max_price}</span>}
                          {r.target_price && <span>Target: ${r.target_price}</span>}
                          {r.section_filter && <span className="ml-2 text-muted-foreground">&middot; {r.section_filter}</span>}
                          {r.quantity > 1 && <span className="ml-2 text-muted-foreground">&middot; x{r.quantity}</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {lastLog?.msg}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
