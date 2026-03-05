"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getSniperSessions, resolveSniperInput, deleteSniperSession, createDemoSessions, updateSniperSession } from "@/lib/api";
import { AlertTriangle, CheckCircle, Chrome, Eye, EyeOff, Loader2, Monitor, Play, RotateCcw, Shield, Trash2, X, Maximize2, Minimize2 } from "lucide-react";

const platformColors: Record<string, string> = {
  ticketmaster: "bg-blue-500",
  stubhub: "bg-purple-600",
  seatgeek: "bg-green-600",
  axs: "bg-red-500",
};

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  idle: { color: "text-gray-400", icon: Monitor, label: "Idle" },
  starting: { color: "text-yellow-500", icon: Loader2, label: "Starting..." },
  running: { color: "text-green-500", icon: Play, label: "Running" },
  needs_input: { color: "text-red-500", icon: AlertTriangle, label: "Needs Input" },
  completed: { color: "text-blue-500", icon: CheckCircle, label: "Complete" },
  error: { color: "text-red-600", icon: X, label: "Error" },
};

export default function SniperPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyAlerts, setShowOnlyAlerts] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = async () => {
    const data = await getSniperSessions();
    setSessions(data);
  };

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // Poll every 3 seconds for live updates
    pollingRef.current = setInterval(refresh, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  const handleResolve = async (id: number) => {
    await resolveSniperInput(id);
    refresh();
  };

  const handleDelete = async (id: number) => {
    await deleteSniperSession(id);
    refresh();
  };

  const handleLoadDemo = async () => {
    await createDemoSessions();
    refresh();
  };

  const toggleExpand = (id: number) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = showOnlyAlerts ? sessions.filter(s => s.needs_input) : sessions;
  const alertCount = sessions.filter(s => s.needs_input).length;

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-pulse text-muted-foreground">Loading sniper...</div></div>;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sniper Control Center</h1>
          <p className="text-sm text-muted-foreground">
            Monitor active snipe sessions. Browser windows appear when action is needed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {alertCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" /> {alertCount} need attention
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <Switch id="alerts-only" checked={showOnlyAlerts} onCheckedChange={setShowOnlyAlerts} />
            <Label htmlFor="alerts-only" className="text-sm">Alerts only</Label>
          </div>
          <Button variant="outline" size="sm" onClick={handleLoadDemo}>
            <Play className="h-3 w-3 mr-1" /> Load Demo
          </Button>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{sessions.length}</p>
            <p className="text-xs text-muted-foreground">Total Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-500">{sessions.filter(s => s.status === "running").length}</p>
            <p className="text-xs text-muted-foreground">Running</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{alertCount}</p>
            <p className="text-xs text-muted-foreground">Need Input</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-500">{sessions.filter(s => s.status === "completed").length}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Monitor className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No active snipe sessions</p>
            <p className="text-sm text-muted-foreground mt-1">Create a snipe rule in Autobuy to get started, or load demo sessions.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((session) => {
            const config = statusConfig[session.status] || statusConfig.idle;
            const Icon = config.icon;
            const isExpanded = expandedSessions.has(session.id);
            const isAlert = session.needs_input;

            return (
              <Card
                key={session.id}
                className={`transition-all ${isAlert ? "ring-2 ring-red-500/50 shadow-lg shadow-red-500/10" : ""}`}
              >
                {/* Browser-style header bar */}
                <div className={`flex items-center gap-2 px-4 py-2 border-b rounded-t-lg ${
                  isAlert ? "bg-red-500/10" : "bg-muted/50"
                }`}>
                  {/* Traffic lights */}
                  <div className="flex gap-1.5">
                    <button
                      className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
                      onClick={() => handleDelete(session.id)}
                      title="Close session"
                    />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <button
                      className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors"
                      onClick={() => toggleExpand(session.id)}
                      title={isExpanded ? "Minimize" : "Maximize"}
                    />
                  </div>

                  {/* URL bar */}
                  <div className="flex-1 flex items-center gap-2 ml-3">
                    <div className={`w-4 h-4 rounded-sm ${platformColors[session.platform] || "bg-gray-400"} flex items-center justify-center`}>
                      <Chrome className="h-2.5 w-2.5 text-white" />
                    </div>
                    <div className="flex-1 bg-background/80 rounded px-3 py-1 text-xs font-mono text-muted-foreground truncate border">
                      {session.browser_url || `https://www.${session.platform}.com`}
                    </div>
                  </div>

                  {/* Status + actions */}
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`${config.color} gap-1`}>
                      <Icon className={`h-3 w-3 ${session.status === "starting" || session.status === "running" ? "animate-spin" : ""}`} />
                      {config.label}
                    </Badge>
                    {isAlert && (
                      <Button size="sm" variant="destructive" onClick={() => handleResolve(session.id)} className="animate-pulse">
                        <Shield className="h-3 w-3 mr-1" /> Resolve
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => toggleExpand(session.id)}>
                      {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Session info - always visible */}
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{session.event_name || "Unknown Event"}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.platform} {session.account_email ? `· ${session.account_email}` : ""}
                      </p>
                    </div>
                    {isAlert && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-red-500">
                          {session.input_type === "captcha" ? "CAPTCHA Detected" :
                           session.input_type === "verification" ? "Verification Required" :
                           "User Input Needed"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Click Resolve after completing the action
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Alert content - shows the "browser" viewport when input needed */}
                  {isAlert && (
                    <div className="mt-4 border rounded-lg overflow-hidden">
                      <div className="bg-muted/30 p-8 flex flex-col items-center justify-center min-h-[200px]">
                        {session.input_type === "captcha" ? (
                          <>
                            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 border-2 border-blue-500 rounded flex items-center justify-center">
                                  <CheckCircle className="h-4 w-4 text-blue-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">I&apos;m not a robot</p>
                                  <p className="text-xs text-muted-foreground">reCAPTCHA</p>
                                </div>
                                <div className="ml-4">
                                  <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==" alt="" className="w-8 h-8" />
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">Complete the CAPTCHA in the browser window, then click Resolve</p>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-3" />
                            <p className="font-medium">Verification Required</p>
                            <p className="text-sm text-muted-foreground mt-1">The site is requesting additional verification.</p>
                            <p className="text-sm text-muted-foreground">Complete it in the browser, then click Resolve.</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Expanded: show log */}
                  {isExpanded && session.log && session.log.length > 0 && (
                    <div className="mt-4 border rounded-lg">
                      <div className="bg-muted/30 px-3 py-2 border-b">
                        <p className="text-xs font-medium text-muted-foreground">Session Log</p>
                      </div>
                      <div className="p-3 max-h-48 overflow-y-auto">
                        {session.log.map((entry: any, i: number) => (
                          <div key={i} className="flex gap-2 text-xs py-1">
                            <span className="text-muted-foreground font-mono whitespace-nowrap">
                              {new Date(entry.time).toLocaleTimeString()}
                            </span>
                            <span className={entry.msg.includes("CAPTCHA") || entry.msg.includes("input") || entry.msg.includes("Popup")
                              ? "text-red-500 font-medium" : ""}>
                              {entry.msg}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
