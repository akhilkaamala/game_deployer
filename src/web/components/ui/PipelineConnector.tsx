import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface PipelineConnectorProps {
  isActive: boolean;
  isError?: boolean;
  className?: string;
}

export function PipelineConnector({
  isActive,
  isError,
  className,
}: PipelineConnectorProps) {
  return (
    <div
      className={cn(
        "relative flex-1 min-w-[60px] h-12 flex items-center justify-center mx-2",
        className,
      )}
    >
      <svg
        width="100%"
        height="24"
        viewBox="0 0 200 24"
        fill="none"
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {/* Base Track */}
        <path
          d="M 0 12 L 200 12"
          stroke="rgba(255, 255, 255, 0.03)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M 0 12 L 200 12"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeDasharray="2 4"
        />

        {/* Active Energy Pulse */}
        <AnimatePresence>
          {isActive && !isError && (
            <>
              {/* Core Glow */}
              <motion.path
                d="M 0 12 L 200 12"
                stroke="rgba(59, 130, 246, 0.4)"
                strokeWidth="4"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="blur-[2px]"
              />

              {/* Moving Pulse Line */}
              <motion.path
                d="M 0 12 L 200 12"
                stroke="url(#pulseGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="40 160"
                animate={{
                  strokeDashoffset: [-200, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: "linear",
                }}
              />

              {/* Particles */}
              {[...Array(3)].map((_, i) => (
                <motion.circle
                  key={i}
                  r="1.5"
                  fill="#60a5fa"
                  initial={{ cx: 0, cy: 12, opacity: 0 }}
                  animate={{
                    cx: [0, 200],
                    opacity: [0, 1, 1, 0],
                    scale: [1, 1.5, 1],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1 + i * 0.4,
                    delay: i * 0.3,
                    ease: "easeInOut",
                  }}
                  className="blur-[0.5px]"
                />
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Error State Line */}
        <AnimatePresence>
          {isError && (
            <motion.path
              d="M 0 12 L 200 12"
              stroke="#ef4444"
              strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5 }}
              strokeDasharray="4 4"
            />
          )}
        </AnimatePresence>

        {/* Gradient Definitions */}
        <defs>
          <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0)" />
            <stop offset="50%" stopColor="rgba(59, 130, 246, 1)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center Status Badge */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <motion.div
          initial={false}
          animate={{
            scale: isActive ? 1.05 : 1,
            borderColor: isActive
              ? "rgba(59, 130, 246, 0.4)"
              : "rgba(255, 255, 255, 0.08)",
            backgroundColor: isActive
              ? "rgba(15, 23, 42, 0.8)"
              : "rgba(15, 23, 42, 0.6)",
          }}
          className={cn(
            "relative px-4 py-1.5 rounded-full border backdrop-blur-xl transition-all duration-500 overflow-hidden group",
            isActive
              ? "shadow-[0_0_20px_rgba(59,130,246,0.15)]"
              : "shadow-none",
          )}
        >
          {/* Scanning Line Effect (Active Only) */}
          {isActive && (
            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400/10 to-transparent h-[50%] w-full"
              animate={{ top: ["-50%", "100%"] }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            />
          )}

          <div className="relative flex items-center gap-2">
            {/* Status Dot */}
            <motion.div
              animate={
                isActive
                  ? {
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 1, 0.5],
                    }
                  : {
                      opacity: [0.2, 0.4, 0.2],
                    }
              }
              transition={{ repeat: Infinity, duration: 2 }}
              className={cn(
                "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor]",
                isActive
                  ? "bg-blue-400 text-blue-400"
                  : "bg-zinc-600 text-zinc-600",
              )}
            />

            <span
              className={cn(
                "text-[9px] font-black tracking-[0.2em] transition-colors duration-500 uppercase",
                isActive ? "text-blue-100" : "text-zinc-500",
              )}
            >
              {isActive ? "Syncing" : "Standby"}
            </span>
          </div>

          {/* Subtle Corner Accents */}
          <div className="absolute top-0 left-2 w-1 h-[1px] bg-white/10" />
          <div className="absolute bottom-0 right-2 w-1 h-[1px] bg-white/10" />
        </motion.div>
      </div>
    </div>
  );
}
