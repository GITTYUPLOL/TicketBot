"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAccounts, getAccountStats, getPlatforms, addAccount, bulkAddAccountsText, deleteAccount, updateAccount } from "@/lib/api";
import { Plus, Upload, Trash2, User, Globe, CheckCircle, XCircle } from "lucide-react";

const platformColors: Record<string, string> = {
  ticketmaster: "bg-blue-500",
  stubhub: "bg-purple-600",
  seatgeek: "bg-green-600",
  axs: "bg-red-500",
  vividseats: "bg-orange-500",
  livenation: "bg-pink-600",
};

const platformLabels: Record<string, string> = {
  ticketmaster: "Ticketmaster",
  stubhub: "StubHub",
  seatgeek: "SeatGeek",
  axs: "AXS",
  vividseats: "VividSeats",
  livenation: "Live Nation",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Single add
  const [addOpen, setAddOpen] = useState(false);
  const [addPlatform, setAddPlatform] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addPassword, setAddPassword] = useState("");

  // Bulk add
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPlatform, setBulkPlatform] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<any>(null);

  const refresh = async () => {
    const platform = selectedPlatform === "all" ? undefined : selectedPlatform;
    const [a, s] = await Promise.all([getAccounts(platform), getAccountStats()]);
    setAccounts(a);
    setStats(s);
  };

  useEffect(() => {
    getPlatforms().then(setPlatforms);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [selectedPlatform]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await addAccount({ platform: addPlatform, email: addEmail, username: addUsername || undefined, password: addPassword || undefined });
    setAddOpen(false);
    setAddEmail(""); setAddUsername(""); setAddPassword("");
    refresh();
  };

  const handleBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await bulkAddAccountsText(bulkPlatform, bulkText);
    setBulkResult(result);
    refresh();
  };

  const handleDelete = async (id: number) => {
    await deleteAccount(id);
    refresh();
  };

  const handleToggleStatus = async (id: number, currentStatus: string) => {
    await updateAccount(id, { status: currentStatus === "active" ? "inactive" : "active" });
    refresh();
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-pulse text-muted-foreground">Loading accounts...</div></div>;

  const totalAccounts = stats.reduce((s: number, p: any) => s + p.count, 0);
  const activeAccounts = stats.reduce((s: number, p: any) => s + p.active_count, 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage your ticket platform accounts</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={bulkOpen} onOpenChange={(o) => { setBulkOpen(o); if (!o) setBulkResult(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="h-4 w-4 mr-1" /> Bulk Import</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Bulk Import Accounts</DialogTitle></DialogHeader>
              <form onSubmit={handleBulk} className="space-y-4">
                <div>
                  <Label>Platform</Label>
                  <Select value={bulkPlatform} onValueChange={setBulkPlatform}>
                    <SelectTrigger><SelectValue placeholder="Select platform..." /></SelectTrigger>
                    <SelectContent>
                      {platforms.map((p) => (
                        <SelectItem key={p} value={p}>{platformLabels[p] || p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Accounts (one per line)</Label>
                  <p className="text-xs text-muted-foreground mb-1">
                    Format: email:password or email:password:username
                  </p>
                  <textarea
                    className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={"user1@gmail.com:password123\nuser2@yahoo.com:pass456:username2\nuser3@outlook.com:pass789"}
                  />
                </div>
                {bulkResult && (
                  <div className="p-3 rounded-md bg-muted text-sm">
                    <p className="font-medium">Import complete</p>
                    <p className="text-green-600">Added: {bulkResult.added}</p>
                    <p className="text-muted-foreground">Skipped (duplicates): {bulkResult.skipped}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={!bulkPlatform || !bulkText.trim()}>
                    <Upload className="h-4 w-4 mr-1" /> Import
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setBulkOpen(false); setBulkResult(null); }}>Close</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <Label>Platform</Label>
                  <Select value={addPlatform} onValueChange={setAddPlatform}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {platforms.map((p) => (
                        <SelectItem key={p} value={p}>{platformLabels[p] || p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Username (optional)</Label>
                    <Input value={addUsername} onChange={(e) => setAddUsername(e.target.value)} />
                  </div>
                  <div>
                    <Label>Password (optional)</Label>
                    <Input type="password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={!addPlatform || !addEmail}>Add</Button>
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Platform overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {platforms.map((p) => {
          const stat = stats.find((s: any) => s.platform === p);
          return (
            <Card
              key={p}
              className={`cursor-pointer transition-all hover:shadow-md ${selectedPlatform === p ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelectedPlatform(selectedPlatform === p ? "all" : p)}
            >
              <CardContent className="p-3 text-center">
                <div className={`w-8 h-8 rounded-full ${platformColors[p] || "bg-gray-500"} mx-auto mb-2 flex items-center justify-center`}>
                  <Globe className="h-4 w-4 text-white" />
                </div>
                <p className="text-xs font-medium">{platformLabels[p] || p}</p>
                <p className="text-lg font-bold">{stat?.count || 0}</p>
                <p className="text-xs text-muted-foreground">{stat?.active_count || 0} active</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{totalAccounts} total accounts</span>
        <span>{activeAccounts} active</span>
        {selectedPlatform !== "all" && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedPlatform("all")}>Show All</Button>
        )}
      </div>

      {/* Accounts table */}
      <Card>
        <CardContent className="p-4">
          {accounts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No accounts found. Add one or bulk import to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${platformColors[a.platform] || "bg-gray-400"}`} />
                          <span className="text-sm font-medium">{platformLabels[a.platform] || a.platform}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{a.email}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.username || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`cursor-pointer ${a.status === "active" ? "text-green-600 border-green-200" : "text-red-500 border-red-200"}`}
                          onClick={() => handleToggleStatus(a.id, a.status)}
                        >
                          {a.status === "active" ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          {a.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
