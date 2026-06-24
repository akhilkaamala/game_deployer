import React from "react";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/utils";
import { getApiUrl } from "../api";
import { SSH_KEYS_UPDATED_EVENT } from "./SshKeyLinker";
import type { DeployEnvironment } from "../types";
import { EnvironmentNode } from "./ui/EnvironmentNode";
import { PipelineConnector } from "./ui/PipelineConnector";
import { motion } from "framer-motion";
import { Loader2, Wifi, WifiOff, Server } from "lucide-react";

interface EnvironmentSelectionProps {
  source: DeployEnvironment;
  target: DeployEnvironment;
  onSourceChange: (env: DeployEnvironment) => void;
  onTargetChange: (env: DeployEnvironment) => void;
  availableEnvironments: string[];
  isDeploying?: boolean;
}

export function EnvironmentSelection({
  source,
  target,
  onSourceChange,
  onTargetChange,
  availableEnvironments,
  isDeploying,
}: EnvironmentSelectionProps) {
  const envs = ["dev", "qa", "preprod"];
  const [statuses, setStatuses] = React.useState<
    Record<string, { status: string; latency?: number }>
  >({});
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});

  const checkStatus = React.useCallback(async (env: string) => {
    setLoading((prev) => ({ ...prev, [env]: true }));
    try {
      const res = await fetch(getApiUrl("/api/system-health"));
      if (res.ok) {
        const data = await res.json();
        const envData = data.environments.find((e: any) => e.name === env);
        if (envData) {
          setStatuses((prev) => ({
            ...prev,
            [env]: { status: envData.status, latency: envData.latencyMs },
          }));
        }
      }
    } catch {
      setStatuses((prev) => ({ ...prev, [env]: { status: "offline" } }));
    } finally {
      setLoading((prev) => ({ ...prev, [env]: false }));
    }
  }, []);

  React.useEffect(() => {
    envs.forEach((env) => checkStatus(env));
    const interval = setInterval(
      () => envs.forEach((env) => checkStatus(env)),
      30000,
    );
    const onKeysUpdated = () => envs.forEach((env) => checkStatus(env));
    window.addEventListener(SSH_KEYS_UPDATED_EVENT, onKeysUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener(SSH_KEYS_UPDATED_EVENT, onKeysUpdated);
    };
  }, [checkStatus]);

  return (
    <div className="relative p-6 rounded-2xl border border-white/5 bg-zinc-950/40 backdrop-blur-xl overflow-hidden group/container shadow-2xl">
      <div className="relative z-10 flex flex-col gap-8">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/10">
              <span className="text-[10px] font-black text-zinc-500 tracking-widest uppercase">Pipeline</span>
              <span className="text-zinc-700 font-light">/</span>
              <span className="text-[10px] font-black text-primary tracking-widest uppercase">Deploy</span>
            </div>
            
            <div className="h-4 w-px bg-white/10" />
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">Status:</span>
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]",
                    isDeploying
                      ? "bg-primary animate-pulse"
                      : "bg-emerald-500/60",
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-tight",
                    isDeploying ? "text-primary" : "text-emerald-500/80",
                  )}
                >
                  {isDeploying ? "Transferring" : "Standby"}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-white/5 border-white/10 text-[9px] font-bold px-2 py-0">
              V2.4.0
            </Badge>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-2">
          <div className="contents">
            {/* Source Side */}
            <div className="w-full lg:w-[38%] flex flex-col gap-2">
              <div className="flex items-center mb-1 px-1">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                  Source
                </span>
              </div>
              {envs.map((env) => (
                <EnvironmentNode
                  key={env}
                  name={env}
                  type="src"
                  status={statuses[env]?.status}
                  isSelected={source === env}
                  isDeploying={isDeploying && source === env}
                  isLoading={loading[env]}
                  onClick={() => onSourceChange(env as DeployEnvironment)}
                />
              ))}
            </div>

            {/* Central Pipeline Connector */}
            <div className="flex-1 w-full lg:w-auto py-4 lg:py-0">
              <PipelineConnector isActive={!!isDeploying} />
            </div>

            {/* Target Side */}
            <div className="w-full lg:w-[38%] flex flex-col gap-2">
              <div className="flex items-center justify-end mb-1 px-1">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                  Destination
                </span>
              </div>
              {envs.map((env) => (
                <EnvironmentNode
                  key={env}
                  name={env}
                  type="dst"
                  status={statuses[env]?.status}
                  isSelected={target === env}
                  isDeploying={isDeploying && target === env}
                  isDisabled={env === source}
                  isLoading={loading[env]}
                  onClick={() => onTargetChange(env as DeployEnvironment)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
