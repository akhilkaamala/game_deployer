import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Server } from "lucide-react";
import { cn } from "../../lib/utils";

interface EnvironmentNodeProps {
  name: string;
  type: "src" | "dst";
  status?: string;
  isSelected: boolean;
  isDeploying?: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
  onClick?: () => void;
}

export function EnvironmentNode({
  name,
  type,
  status = "offline",
  isSelected,
  isDeploying,
  isDisabled,
  isLoading,
  onClick,
}: EnvironmentNodeProps) {
  const isOnline = status === "online";

  const getEnvColor = (env: string) => {
    switch (env.toLowerCase()) {
      case "dev":
        return "blue";
      case "qa":
        return "orange";
      case "preprod":
        return "purple";
      case "prod":
        return "red";
      default:
        return "zinc";
    }
  };

  const color = getEnvColor(name);

  return (
    <motion.div
      animate={{
        opacity: isDisabled ? 0.3 : 1,
        filter: isDisabled ? "grayscale(100%)" : "grayscale(0%)",
      }}
      transition={{ duration: 0.7, ease: "easeInOut" }}
      whileHover={!isDisabled ? { y: -1 } : {}}
      whileTap={!isDisabled ? { scale: 0.99 } : {}}
      className={cn(
        "relative w-full min-w-[180px]",
        isDisabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
      onClick={!isDisabled ? onClick : undefined}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border p-3.5 backdrop-blur-sm h-full transition-all duration-700 ease-in-out",
          isSelected
            ? "border-transparent shadow-xl"
            : "bg-white/5 border-white/5 hover:border-white/10",
        )}
      >
        {/* Animated Selection Background - Luxurious Fade */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }} // Smooth Material Easing
              className={cn(
                "absolute inset-0 z-0 rounded-xl",
                color === "blue" &&
                  "shadow-[inset_0_0_0_2px_rgba(59,130,246,0.5)] bg-blue-500/10",
                color === "orange" &&
                  "shadow-[inset_0_0_0_2px_rgba(249,115,22,0.5)] bg-orange-500/10",
                color === "purple" &&
                  "shadow-[inset_0_0_0_2px_rgba(168,85,247,0.5)] bg-purple-500/10",
                color === "red" &&
                  "shadow-[inset_0_0_0_2px_rgba(239,68,68,0.5)] bg-red-500/10",
                color === "zinc" &&
                  "shadow-[inset_0_0_0_2px_rgba(113,113,122,0.5)] bg-zinc-500/10",
              )}
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 flex flex-col gap-3 pointer-events-none select-none">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "p-2 rounded-lg bg-white/5 border border-white/5 transition-all duration-700 ease-in-out",
                  isSelected && "bg-white/10 border-white/10 shadow-inner",
                )}
              >
                {name.toLowerCase() === "prod" ? (
                  <Shield
                    className={cn(
                      "w-3.5 h-3.5 transition-colors duration-700 ease-in-out",
                      isSelected ? "text-red-400" : "text-zinc-500",
                    )}
                  />
                ) : (
                  <Server
                    className={cn(
                      "w-3.5 h-3.5 transition-colors duration-700 ease-in-out",
                      isSelected ? "text-blue-400" : "text-zinc-500",
                    )}
                  />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    "text-sm font-bold tracking-tight truncate transition-colors duration-700 ease-in-out",
                    isSelected ? "text-white" : "text-zinc-400",
                  )}
                >
                  {name.toUpperCase()}
                </span>
                <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider leading-none">
                  {type === "src" ? "Source" : "Target"}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 transition-all duration-700 ease-in-out",
                  isOnline ? "text-emerald-400/80" : "text-red-400/80",
                )}
              >
                <div
                  className={cn(
                    "w-1 h-1 rounded-full",
                    isOnline ? "bg-emerald-500" : "bg-red-500",
                    isOnline && isSelected && "animate-pulse",
                  )}
                />
                <span className="text-[9px] font-bold uppercase tracking-tight">
                  {status === "unknown" ? "offline" : status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle Active Indicator */}
        {isDeploying && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent z-20 pointer-events-none"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          />
        )}
      </div>
    </motion.div>
  );
}
