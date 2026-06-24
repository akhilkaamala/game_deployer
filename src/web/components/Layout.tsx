import React from "react";
import {
  LayoutDashboard,
  History,
  Settings,
  ShieldCheck,
  Server,
  Activity,
  Gamepad2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Command,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/Button";
import { getApiUrl } from "../api";
import { EnvironmentsManager } from "./EnvironmentsManager";
import { SystemHealth } from "./SystemHealth";
import { GamesManager } from "./GamesManager";
import { SettingsManager } from "./Settings";
import { BackupsManager } from "./BackupsManager";
import { DeployHistory } from "./DeployHistory";
import { ReleaseNotesManager } from "./ReleaseNotesManager";
import { LogoMark } from "./LogoMark";

declare var __APP_VERSION__: string;

interface LayoutProps {
  children: React.ReactNode;
  onLogout?: () => void;
  currentUser?: string;
}

export function Layout({ children, onLogout, currentUser }: LayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(true);
  const [serverOnline, setServerOnline] = React.useState<boolean | null>(null);
  const [activePage, setActivePage] = React.useState("Dashboard");
  const [envStatuses, setEnvStatuses] = React.useState<
    { name: string; status: string }[]
  >([]);

  React.useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(getApiUrl("/api/health"), {
          signal: AbortSignal.timeout(3000),
        });
        setServerOnline(res.ok);
      } catch {
        setServerOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  // Phase 1: load env names immediately from /api/config so pills appear right away
  React.useEffect(() => {
    fetch(getApiUrl("/api/config"))
      .then((r) => r.json())
      .then((data) => {
        const names = Object.keys(
          data.gameFolderMap ? data.serverBasePaths || {} : {},
        );
        // Build initial "checking" state from gameCatalog servers
        const serverNames = Object.keys(data.serverBasePaths || {});
        if (serverNames.length > 0) {
          setEnvStatuses(
            serverNames.map((name) => ({ name, status: "checking" })),
          );
        }
      })
      .catch(() => { });
  }, []);

  // Phase 2: run SSH health check, update statuses when done
  React.useEffect(() => {
    const checkEnvs = async () => {
      try {
        const res = await fetch(getApiUrl("/api/system-health"), {
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          const data = await res.json();
          setEnvStatuses(data.environments || []);
        } else {
          // If server returns error, mark all as offline
          setEnvStatuses((prev) =>
            prev.map((env) => ({ ...env, status: "offline" })),
          );
        }
      } catch (err) {
        // On network error or timeout, mark all as offline
        setEnvStatuses((prev) =>
          prev.map((env) => ({ ...env, status: "offline" })),
        );
      }
    };
    // Slight delay so the server has time to fully start
    const initial = setTimeout(checkEnvs, 1000);
    const interval = setInterval(checkEnvs, 30000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard" },
    { icon: ClipboardList, label: "Release Notes" },
    { icon: History, label: "Deploy History" },
    { icon: ShieldCheck, label: "Backups" },
    { icon: Server, label: "Environments" },
    { icon: Gamepad2, label: "Games" },
    { icon: Activity, label: "System Health" },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30">
      {/* Sidebar */}
      <aside
        className={cn(
          "relative flex flex-col border-r border-border bg-card/50 backdrop-blur-xl transition-all duration-300 ease-in-out z-30",
          isSidebarCollapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex items-center gap-3 px-6 h-16 border-b border-border">
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center overflow-hidden p-1.5 group/logo transition-all hover:border-primary/50 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <LogoMark />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight text-white">
                AGGR BLAZE
              </span>
              <span className="text-[10px] text-muted-foreground uppercase font-medium">
                DevOps Center
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setActivePage(item.label)}
              className={cn(
                "group flex items-center w-full gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                activePage === item.label
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 shrink-0",
                  activePage !== item.label &&
                  "group-hover:scale-110 transition-transform",
                )}
              />
              {!isSidebarCollapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          {/* Logged-in user badge */}
          {currentUser && (
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/8 mb-1",
                isSidebarCollapsed && "justify-center px-0"
              )}
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                <span className="text-[11px] font-black text-primary uppercase">
                  {currentUser.charAt(0)}
                </span>
              </div>
              {!isSidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate capitalize">
                    {currentUser}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-medium">Logged in</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="flex items-center w-full gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
          >
            {isDarkMode ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
            {!isSidebarCollapsed && (
              <span className="text-sm font-medium">
                {isDarkMode ? "Light Mode" : "Dark Mode"}
              </span>
            )}
          </button>

          {/* Divider */}
          <div className="my-1 h-px bg-border/60" />

          {/* Logout */}
          <button
            onClick={onLogout}
            title="Logout"
            className="group flex items-center w-full gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 shrink-0 group-hover:translate-x-0.5 transition-transform duration-200" />
            {!isSidebarCollapsed && (
              <span className="text-sm font-medium">Logout</span>
            )}
          </button>
        </div>

        {/* Sidebar Toggle */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full border border-border bg-background shadow-md flex items-center justify-center hover:bg-accent transition-colors z-40"
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent">
        <header className="sticky top-0 h-16 flex items-center justify-between px-8 bg-background/95 backdrop-blur-md border-b border-border z-20 [transform:translateZ(0)] isolate">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold">{activePage}</h1>
            <p className="text-xs text-muted-foreground">
              {activePage === "Environments"
                ? "Manage server configurations for all deployment targets"
                : activePage === "Release Notes"
                  ? "Build client release notes from game selection and export to Excel or PDF"
                  : activePage === "Deploy History"
                    ? "Audit and review past deployment sessions and their status"
                    : activePage === "System Health"
                      ? "Monitor SSH connectivity and server metrics in real time"
                      : activePage === "Games"
                        ? "Manage the full game catalog — add, edit, or remove games"
                        : activePage === "Settings"
                          ? "Configure deployment defaults, backups, and UI preferences"
                          : activePage === "Backups"
                            ? "Manage historical environment snapshots and backup retention"
                            : "Manage and monitor game releases across environments"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Environment Status Pills */}
            {envStatuses.map((env) => {
              const isChecking = env.status === "checking";
              const isOnline = env.status === "online";
              const label = (env.name || "ENV").toUpperCase();
              return (
                <div
                  key={env.name}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all duration-500",
                    isChecking
                      ? "bg-secondary/50 border-border text-zinc-500"
                      : isOnline
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400",
                  )}
                >
                  <span className="text-zinc-500">{label}</span>
                  <span className="text-zinc-600">:</span>
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full animate-pulse",
                      isChecking
                        ? "bg-zinc-500"
                        : isOnline
                          ? "bg-emerald-500"
                          : "bg-red-500",
                    )}
                  />
                  <span>
                    {isChecking ? "..." : isOnline ? "Online" : "Offline"}
                  </span>
                </div>
              );
            })}

            {/* Server Online Indicator */}
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors duration-500",
                serverOnline === null
                  ? "bg-secondary/50 border-border"
                  : serverOnline
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-red-500/10 border-red-500/30",
              )}
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full transition-colors duration-500",
                  serverOnline === null
                    ? "bg-zinc-500"
                    : serverOnline
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-red-500",
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium uppercase transition-colors duration-500",
                  serverOnline === null
                    ? "text-zinc-400"
                    : serverOnline
                      ? "text-emerald-400"
                      : "text-red-400",
                )}
              >
                {serverOnline === null
                  ? "Checking..."
                  : serverOnline
                    ? "Server Online"
                    : "Server Offline"}
              </span>
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Activity className="w-4 h-4" />
              <span>v{__APP_VERSION__}</span>
            </Button>
          </div>
        </header>

        <div className="p-8 pb-20">
          {activePage === "Environments" ? (
            <EnvironmentsManager />
          ) : activePage === "Release Notes" ? (
            <ReleaseNotesManager />
          ) : activePage === "Deploy History" ? (
            <DeployHistory />
          ) : activePage === "System Health" ? (
            <SystemHealth />
          ) : activePage === "Games" ? (
            <GamesManager />
          ) : activePage === "Settings" ? (
            <SettingsManager />
          ) : activePage === "Backups" ? (
            <BackupsManager />
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
