"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Search, Zap, User, ShoppingBag, Menu, Crosshair, KeyRound, Moon, Sun, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: Search },
  { href: "/autobuy", label: "Autobuy", icon: Zap },
  { href: "/sniper", label: "Sniper", icon: Crosshair },
  { href: "/accounts", label: "Accounts", icon: KeyRound },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/profile", label: "Profile", icon: User },
];

type TicketbotEnvironment = "live" | "test";
const ENV_STORAGE_KEY = "ticketbot-env";

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const storedTheme = localStorage.getItem("ticketbot-theme");
    return storedTheme === "dark" || (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });
  const [environment, setEnvironment] = useState<TicketbotEnvironment>(() => {
    if (typeof window === "undefined") return "test";
    return localStorage.getItem(ENV_STORAGE_KEY) === "live" ? "live" : "test";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("ticketbot-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem(ENV_STORAGE_KEY, environment);
  }, [environment]);

  const toggleTheme = () => {
    setDark((prev) => !prev);
  };

  const switchEnvironment = (nextEnvironment: TicketbotEnvironment) => {
    if (nextEnvironment === environment) return;
    setEnvironment(nextEnvironment);
    window.dispatchEvent(new CustomEvent("ticketbot-env-change", { detail: nextEnvironment }));
    window.location.reload();
  };

  const NavLink = ({ item, onClick }: { item: typeof navItems[0]; onClick?: () => void }) => (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200",
        pathname === item.href || pathname.startsWith(item.href + "/")
          ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-md shadow-fuchsia-500/20"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      <item.icon className="h-4 w-4" />
      {item.label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center px-4 md:px-6">
        <Link href="/dashboard" className="mr-6 flex items-center space-x-2 group">
          <div className="relative">
            <Music className="h-5 w-5 text-fuchsia-500 transition-transform group-hover:scale-110" />
            <div className="absolute inset-0 h-5 w-5 text-fuchsia-500 animate-ping opacity-20">
              <Music className="h-5 w-5" />
            </div>
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 bg-clip-text text-transparent">
            Ticketbot
          </span>
        </Link>

        <nav className="hidden md:flex items-center space-x-1 flex-1">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden sm:inline-flex items-center rounded-full border border-border/60 p-0.5">
            <button
              type="button"
              onClick={() => switchEnvironment("test")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                environment === "test"
                  ? "bg-fuchsia-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              TEST
            </button>
            <button
              type="button"
              onClick={() => switchEnvironment("live")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                environment === "live"
                  ? "bg-emerald-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              LIVE
            </button>
          </div>

          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {dark ? <Sun className="h-4 w-4 text-yellow-400" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <div className="flex items-center gap-2 mb-6 mt-4">
                <Music className="h-5 w-5 text-fuchsia-500" />
                <span className="font-bold text-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 bg-clip-text text-transparent">
                  Ticketbot
                </span>
              </div>
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Environment</p>
                <div className="inline-flex w-full items-center rounded-full border border-border/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => switchEnvironment("test")}
                    className={cn(
                      "w-1/2 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      environment === "test"
                        ? "bg-fuchsia-600 text-white"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    TEST
                  </button>
                  <button
                    type="button"
                    onClick={() => switchEnvironment("live")}
                    className={cn(
                      "w-1/2 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                      environment === "live"
                        ? "bg-emerald-600 text-white"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    LIVE
                  </button>
                </div>
              </div>
              <nav className="flex flex-col space-y-1">
                {navItems.map((item) => (
                  <NavLink key={item.href} item={item} onClick={() => setOpen(false)} />
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
