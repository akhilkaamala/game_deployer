import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface PipelineConnectorProps {
  isActive: boolean;
  isError?: boolean;
  className?: string;
}

export function PipelineConnector({ isActive, isError, className }: PipelineConnectorProps) {
  return (
    <div className={cn("relative flex-1 min-w-[40px] h-12 flex items-center justify-center mx-4", className)}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 20"
        fill="none"
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {/* Base Path */}
        <path
          d="M 0 10 L 200 10"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="4 4"
        />

        {/* Active Flow Path */}
        <motion.path
          d="M 0 10 L 200 10"
          stroke={isError ? "#ef4444" : "#3b82f6"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="4 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: 1,
            opacity: 1,
            strokeDashoffset: isActive ? [-16, 0] : 0,
          }}
          transition={{
            pathLength: { duration: 0.5 },
            opacity: { duration: 0.5 },
            strokeDashoffset: {
              repeat: Infinity,
              duration: 1,
              ease: "linear",
            },
          }}
        />

        {/* Subtle Glow (Only when active) */}
        {isActive && (
          <motion.path
            d="M 0 10 L 200 10"
            stroke={isError ? "#ef4444" : "#3b82f6"}
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.1, 0.2, 0.1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="blur-[2px]"
          />
        )}
      </svg>

      {/* Center Status Badge */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={cn(
          "px-2 py-0.5 rounded-full text-[8px] font-bold tracking-wider border transition-all duration-300",
          isActive 
            ? "bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-sm" 
            : "bg-zinc-900 border-white/5 text-zinc-600"
        )}>
          {isActive ? "SYNCING" : "IDLE"}
        </div>
      </div>
    </div>
  );
}
