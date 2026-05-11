import React from "react";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/utils";
import { ArrowRight, Server, Wifi, WifiOff, Loader2 } from "lucide-react";
import { getApiUrl } from "../api";
import type { DeployEnvironment } from "../types";

interface EnvironmentSelectionProps {
  source: DeployEnvironment;
  target: DeployEnvironment;
  onSourceChange: (env: DeployEnvironment) => void;
  onTargetChange: (env: DeployEnvironment) => void;
  availableEnvironments: string[];
}

export function EnvironmentSelection({
  source,
  target,
  onSourceChange,
  onTargetChange,
  availableEnvironments,
}: EnvironmentSelectionProps) {
  const envs = ["dev", "qa", "preprod"];
  const [statuses, setStatuses] = React.useState<Record<string, { status: string; latency?: number }>>({});
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});

  const checkStatus = React.useCallback(async (env: string) => {
    setLoading(prev => ({ ...prev, [env]: true }));
    try {
      const res = await fetch(getApiUrl("/api/system-health"));
      if (res.ok) {
        const data = await res.json();
        const envData = data.environments.find((e: any) => e.name === env);
        if (envData) {
          setStatuses(prev => ({ ...prev, [env]: { status: envData.status, latency: envData.latencyMs } }));
        }
      }
    } catch {
      setStatuses(prev => ({ ...prev, [env]: { status: "offline" } }));
    } finally {
      setLoading(prev => ({ ...prev, [env]: false }));
    }
  }, []);

  React.useEffect(() => {
    checkStatus(source);
    const interval = setInterval(() => checkStatus(source), 30000);
    return () => clearInterval(interval);
  }, [source, checkStatus]);

  React.useEffect(() => {
    checkStatus(target);
    const interval = setInterval(() => checkStatus(target), 30000);
    return () => clearInterval(interval);
  }, [target, checkStatus]);

  return (
    <div className="flex flex-col gap-6 p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Environment Pipeline
        </h3>
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-zinc-500" />
          <span className="text-xs text-zinc-500">
            Active Pipeline: {source.toUpperCase()} → {target.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-start gap-8">
        {/* Source */}
        <div className="flex-1 w-full space-y-3">
          <label className="text-xs font-medium text-zinc-500 uppercase">
            Source Environment
          </label>
          <div className="grid grid-cols-2 gap-2">
            {envs.map((env) => (
              <button
                key={env}
                onClick={() => onSourceChange(env as DeployEnvironment)}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-lg border transition-all",
                  source === env
                    ? "bg-blue-500/10 border-blue-500/50 shadow-lg shadow-blue-500/10"
                    : "bg-white/5 border-white/10 hover:border-white/20",
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    source === env ? "text-blue-400" : "text-zinc-400",
                  )}
                >
                  {env.toUpperCase()}
                </span>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={env as any} className="h-4 px-1 text-[10px]">
                    SRC
                  </Badge>
                  {source === env && (
                    <div className={cn(
                      "flex items-center gap-1 text-[9px] font-bold uppercase",
                      statuses[env]?.status === "online" ? "text-emerald-400" : "text-red-400"
                    )}>
                      {loading[env] ? <Loader2 className="w-2 h-2 animate-spin" /> : 
                       statuses[env]?.status === "online" ? <Wifi className="w-2 h-2" /> : <WifiOff className="w-2 h-2" />}
                      {statuses[env]?.status || "checking"}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="hidden md:flex flex-col items-center justify-start h-full">
          {/* Vertical spacer to match the label + gap height (text-xs = 12px, space-y-3 = 12px, total ~24px) */}
          <div className="h-6" />
          {/* Centering the arrow relative to the grid buttons (grid with 2 rows is ~104px high) */}
          <div className="flex-1 flex items-center justify-center min-h-[104px]">
            <div className="shrink-0 p-3 rounded-full bg-white/5 border border-white/10">
              <ArrowRight className="w-5 h-5 text-zinc-600" />
            </div>
          </div>
        </div>

        {/* Target */}
        <div className="flex-1 w-full space-y-3">
          <label className="text-xs font-medium text-zinc-500 uppercase">
            Target Environment
          </label>
          <div className="grid grid-cols-2 gap-2">
            {envs.map((env) => {
              const isDisabled = env === source;
              return (
                <button
                  key={env}
                  disabled={isDisabled}
                  onClick={() => onTargetChange(env as DeployEnvironment)}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-lg border transition-all",
                    target === env
                      ? "bg-red-500/10 border-red-500/50 shadow-lg shadow-red-500/10"
                      : "bg-white/5 border-white/10 hover:border-white/20",
                    isDisabled && "opacity-20 cursor-not-allowed grayscale",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-medium",
                      target === env ? "text-red-400" : "text-zinc-400",
                    )}
                  >
                    {env.toUpperCase()}
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={env as any} className="h-4 px-1 text-[10px]">
                      DST
                    </Badge>
                    {target === env && (
                      <div className={cn(
                        "flex items-center gap-1 text-[9px] font-bold uppercase",
                        statuses[env]?.status === "online" ? "text-emerald-400" : "text-red-400"
                      )}>
                        {loading[env] ? <Loader2 className="w-2 h-2 animate-spin" /> : 
                         statuses[env]?.status === "online" ? <Wifi className="w-2 h-2" /> : <WifiOff className="w-2 h-2" />}
                        {statuses[env]?.status || "checking"}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
