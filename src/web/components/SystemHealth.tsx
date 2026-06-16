import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Wifi,
  WifiOff,
  Server,
  Cpu,
  MemoryStick,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Globe,
  Terminal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";
import { getApiUrl } from "../api";

interface MemoryMB {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  systemTotal: number;
}

interface ServerHealth {
  uptime: number;
  memoryMB: MemoryMB;
  nodeVersion: string;
  platform: string;
}

interface EnvHealth {
  name: string;
  status: "online" | "offline" | "checking";
  latencyMs?: number;
  error?: string;
  s3Bucket?: string | null;
  s3UsageBytes?: number | null;
  s3UsageError?: string;
}

interface SystemHealthData {
  server: ServerHealth;
  environments: EnvHealth[];
  checkedAt: string;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "--";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function MemoryBar({
  used,
  total,
  label,
}: {
  used: number;
  total: number;
  label: string;
}) {
  const safeTotal = total > 0 ? total : 1;
  const pct = Math.min(100, Math.round((used / safeTotal) * 100));
  const color =
    pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="font-mono">
          {used} / {safeTotal} MB{" "}
          <span className="text-zinc-500">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
    </div>
  );
}

const ENV_COLORS: Record<string, { card: string; badge: string; dot: string }> =
  {
    dev: {
      card: "from-blue-500/10 to-transparent border-blue-500/20",
      badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      dot: "bg-blue-500",
    },
    qa: {
      card: "from-emerald-500/10 to-transparent border-emerald-500/20",
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      dot: "bg-emerald-500",
    },
    preprod: {
      card: "from-amber-500/10 to-transparent border-amber-500/20",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      dot: "bg-amber-500",
    },
  };

function getEnvStyle(name: string) {
  const lower = name.toLowerCase();
  for (const key of Object.keys(ENV_COLORS)) {
    if (lower.includes(key)) return ENV_COLORS[key];
  }
  return {
    card: "from-purple-500/10 to-transparent border-purple-500/20",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    dot: "bg-purple-500",
  };
}

export function SystemHealth() {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async (isManual = false) => {
    if (isManual) setChecking(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/system-health"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: SystemHealthData = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message || "Failed to fetch health data");
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(() => fetchHealth(), 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-500">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm">Checking all environments…</p>
        <p className="text-xs text-zinc-600">
          This may take a few seconds while SSH connections are verified
        </p>
      </div>
    );
  }

  const onlineCount =
    data?.environments.filter((e) => e.status === "online").length ?? 0;
  const totalCount = data?.environments.length ?? 0;
  const allOnline = onlineCount === totalCount && totalCount > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">System Health</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {lastRefresh
              ? `Last checked at ${lastRefresh.toLocaleTimeString()} · Auto-refreshes every 30s`
              : "Checking…"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchHealth(true)}
          disabled={checking}
          className="gap-2"
        >
          <RefreshCw className={cn("w-4 h-4", checking && "animate-spin")} />
          {checking ? "Checking…" : "Refresh Now"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Overall Status Banner */}
      {data && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "flex items-center gap-4 p-4 rounded-xl border",
            allOnline
              ? "bg-emerald-500/5 border-emerald-500/20"
              : "bg-amber-500/5 border-amber-500/20",
          )}
        >
          {allOnline ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          ) : (
            <XCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p
              className={cn(
                "font-bold text-sm",
                allOnline ? "text-emerald-400" : "text-amber-400",
              )}
            >
              {allOnline
                ? "All Systems Operational"
                : `${onlineCount}/${totalCount} Environments Online`}
            </p>
            <p className="text-xs text-zinc-500">
              {data.checkedAt
                ? `Checked at ${new Date(data.checkedAt).toLocaleTimeString()}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data.environments.map((env) => (
              <div
                key={env.name}
                className={cn(
                  "w-2 h-2 rounded-full",
                  env.status === "online"
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-red-500",
                )}
                title={`${env.name}: ${env.status}`}
              />
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* API Server Metrics */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-1"
          >
            <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Server className="w-4 h-4 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest">
                    API Server
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Uptime */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <div>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                      Uptime
                    </p>
                    <p className="text-sm font-bold font-mono text-emerald-400">
                      {formatUptime(data.server.uptime)}
                    </p>
                  </div>
                </div>

                {/* Memory */}
                <div className="space-y-3 p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <MemoryStick className="w-4 h-4 text-zinc-400" />
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                      Memory
                    </span>
                  </div>
                  <MemoryBar
                    used={data.server.memoryMB.heapUsed}
                    total={data.server.memoryMB.heapTotal}
                    label="Heap"
                  />
                  <MemoryBar
                    used={data.server.memoryMB.rss}
                    total={data.server.memoryMB.systemTotal}
                    label="RSS"
                  />
                </div>

                {/* Runtime Info */}
                <div className="space-y-2">
                  {[
                    {
                      icon: Terminal,
                      label: "Node.js",
                      value: data.server.nodeVersion,
                    },
                    {
                      icon: Globe,
                      label: "Platform",
                      value: data.server.platform,
                    },
                  ].map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-1.5 text-zinc-500">
                        <Icon className="w-3 h-3" /> {label}
                      </span>
                      <span className="font-mono text-zinc-300">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Environment SSH Status */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Wifi className="w-4 h-4" /> SSH Connectivity
          </h3>
          <AnimatePresence>
            {data?.environments.map((env, i) => {
              const style = getEnvStyle(env.name);
              const isOnline = env.status === "online";
              return (
                <motion.div
                  key={env.name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className={cn("bg-gradient-to-r border", style.card)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Status Icon */}
                        <div
                          className={cn(
                            "flex-shrink-0 p-2 rounded-lg",
                            isOnline ? "bg-emerald-500/10" : "bg-red-500/10",
                          )}
                        >
                          {isOnline ? (
                            <Wifi className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <WifiOff className="w-5 h-5 text-red-400" />
                          )}
                        </div>

                        {/* Name + Status */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-widest",
                                style.badge,
                              )}
                            >
                              {env.name}
                            </span>
                            <span
                              className={cn(
                                "text-xs font-bold",
                                isOnline ? "text-emerald-400" : "text-red-400",
                              )}
                            >
                              {isOnline ? "Connected" : "Offline"}
                            </span>
                          </div>
                          {env.error && (
                            <p className="text-[10px] text-red-400/70 mt-1 truncate font-mono">
                              {env.error}
                            </p>
                          )}
                          <p className="text-[10px] text-zinc-500 mt-1 font-mono">
                            S3:{" "}
                            {env.s3Bucket
                              ? env.s3UsageBytes !== null &&
                                env.s3UsageBytes !== undefined
                                ? `${formatBytes(env.s3UsageBytes)} (${env.s3Bucket})`
                                : env.s3UsageError
                                  ? `${env.s3UsageError} (${env.s3Bucket})`
                                  : `Checking... (${env.s3Bucket})`
                              : "Not configured"}
                          </p>
                        </div>

                        {/* Latency */}
                        {env.latencyMs !== undefined && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                              Latency
                            </p>
                            <p
                              className={cn(
                                "text-sm font-bold font-mono",
                                env.latencyMs < 500
                                  ? "text-emerald-400"
                                  : env.latencyMs < 2000
                                    ? "text-amber-400"
                                    : "text-red-400",
                              )}
                            >
                              {env.latencyMs > 1000
                                ? `${(env.latencyMs / 1000).toFixed(1)}s`
                                : `${env.latencyMs}ms`}
                            </p>
                          </div>
                        )}

                        {/* Status dot */}
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full flex-shrink-0",
                            isOnline
                              ? "bg-emerald-500 animate-pulse"
                              : "bg-red-500",
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
