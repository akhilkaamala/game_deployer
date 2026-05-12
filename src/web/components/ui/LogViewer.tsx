import React, { useEffect, useRef, useMemo } from "react";
import {
  Terminal,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { Button } from "./Button";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface LogEntry {
  level: string;
  message: string;
  timestamp?: string;
}

interface LogViewerProps {
  logs: LogEntry[];
  state: "idle" | "loading" | "done" | "error";
  selectedGames?: string[];
  onClear?: () => void;
  onDownload?: () => void;
}

const GAME_COLORS = [
  { text: "text-cyan-400", bg: "bg-cyan-400" },
  { text: "text-purple-400", bg: "bg-purple-400" },
  { text: "text-amber-400", bg: "bg-amber-400" },
  { text: "text-pink-400", bg: "bg-pink-400" },
  { text: "text-emerald-400", bg: "bg-emerald-400" },
  { text: "text-orange-400", bg: "bg-orange-400" },
  { text: "text-indigo-400", bg: "bg-indigo-400" },
  { text: "text-lime-400", bg: "bg-lime-400" },
  { text: "text-sky-400", bg: "bg-sky-400" },
  { text: "text-rose-400", bg: "bg-rose-400" },
];

export function LogViewer({
  logs,
  state,
  selectedGames = [],
  onClear,
  onDownload,
}: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [showOverflow, setShowOverflow] = React.useState(false);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const checkOverflow = React.useCallback(() => {
    if (legendRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = legendRef.current;
      setShowOverflow(
        scrollWidth > clientWidth &&
          scrollLeft + clientWidth < scrollWidth - 10,
      );
    }
  }, []);

  const getLogColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "error":
        return "text-red-400";
      case "warn":
      case "warning":
        return "text-yellow-400";
      case "success":
        return "text-emerald-400";
      case "info":
        return "text-blue-400";
      default:
        return "text-zinc-300";
    }
  };

  const { processedLogs, gameMap } = useMemo(() => {
    let activeGame = "";
    const gameToColor = new Map<string, (typeof GAME_COLORS)[0]>();
    let nextColorIndex = 0;

    // 0. Pre-populate from selectedGames to show them on top by default
    selectedGames.forEach((game) => {
      if (!gameToColor.has(game)) {
        gameToColor.set(game, GAME_COLORS[nextColorIndex % GAME_COLORS.length]);
        nextColorIndex++;
      }
    });

    // 1. First pass: identify any NEW games from logs
    logs.forEach((log) => {
      const deployMatch = log.message.match(/^Deploying\s+(.+)$/i);
      if (deployMatch) {
        const name = deployMatch[1].trim();
        if (name !== "Core Files" && !gameToColor.has(name)) {
          gameToColor.set(
            name,
            GAME_COLORS[nextColorIndex % GAME_COLORS.length],
          );
          nextColorIndex++;
        }
      }
    });

    // 2. Second pass: apply colors
    const processed = logs.map((log) => {
      let logColor = null;

      const deployMatch = log.message.match(/^Deploying\s+(.+)$/i);
      if (deployMatch) {
        const name = deployMatch[1].trim();
        if (name !== "Core Files") {
          activeGame = name;
        } else {
          activeGame = "";
        }
      }

      let summaryGameMatch = null;
      for (const gameName of gameToColor.keys()) {
        if (log.message.startsWith(gameName) && log.message.includes(" : ")) {
          summaryGameMatch = gameName;
          break;
        }
      }

      if (summaryGameMatch) {
        logColor = gameToColor.get(summaryGameMatch)?.text;
      } else if (activeGame) {
        logColor = gameToColor.get(activeGame)?.text;
      }

      return {
        ...log,
        colorClass: logColor,
      };
    });

    return { processedLogs: processed, gameMap: gameToColor };
  }, [logs, selectedGames]);

  useEffect(() => {
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [gameMap, checkOverflow]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-6 overflow-hidden flex-1">
          <div className="flex items-center gap-2 shrink-0">
            <Terminal className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-mono font-medium text-zinc-300 uppercase tracking-wider">
              Terminal
            </span>
          </div>

          {/* Game Legend */}
          {gameMap.size > 0 && (
            <div className="relative flex-1 overflow-hidden flex items-center">
              <div
                ref={legendRef}
                onScroll={checkOverflow}
                className="flex items-center gap-6 overflow-x-auto no-scrollbar py-1 scroll-smooth"
              >
                <div className="w-px h-4 bg-white/10 shrink-0" />
                {Array.from(gameMap.entries()).map(([name, colors], index) => (
                  <React.Fragment key={name}>
                    {index > 0 && (
                      <div className="w-px h-3 bg-white/20 shrink-0" />
                    )}
                    <div
                      className="flex items-center gap-2 shrink-0 animate-in fade-in slide-in-from-left-2 duration-300"
                      title={name}
                    >
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full shadow-sm",
                          colors.bg,
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          colors.text,
                        )}
                      >
                        {name}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
                {/* Spacer at the end for the persistent indicator */}
                <div className="w-4 shrink-0" />
              </div>

              {/* Overflow Indicator */}
              <div
                className={cn(
                  "absolute right-0 top-0 bottom-0 z-40 pointer-events-none flex items-center pr-2 bg-gradient-to-l from-zinc-950 via-zinc-950/90 to-transparent transition-opacity duration-300",
                  showOverflow ? "opacity-100" : "opacity-0",
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const colors = ["#22d3ee", "#a855f7", "#ec4899"];
                      const color = colors[i % colors.length];
                      return (
                        <motion.div
                          key={i}
                          animate={{
                            x: [0, 6, 0],
                            opacity: [
                              0.3 + (i / 10) * 0.2,
                              0.6 + (i / 10) * 0.4,
                              0.3 + (i / 10) * 0.2,
                            ],
                            scale: [0.9, 1.4, 0.9],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.1,
                            ease: "easeInOut",
                          }}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: color,
                            boxShadow: `0 0 15px ${color}80`,
                          }}
                        />
                      );
                    })}
                  </div>
                  <motion.div
                    animate={{
                      x: [0, 4, 0],
                      opacity: [0.8, 1, 0.8],
                      scale: [1, 1.15, 1],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: 1.0,
                      ease: "easeInOut",
                    }}
                    className="flex items-center"
                  >
                    <ChevronRight className="w-8 h-8 text-primary filter drop-shadow-[0_0_12px_rgba(var(--primary-rgb),0.5)]" />
                  </motion.div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-white"
            onClick={onDownload}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-red-400"
            onClick={onClear}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed no-scrollbar"
      >
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2 opacity-50">
            <Terminal className="w-8 h-8" />
            <p>Waiting for deployment logs...</p>
          </div>
        )}
        {processedLogs.map((log, index) => (
          <div
            key={index}
            className="group flex gap-3 hover:bg-white/5 -mx-4 px-4 py-0.5 transition-colors"
          >
            <span className="text-zinc-600 select-none min-w-[3rem] text-right">
              {index + 1}
            </span>
            {log.timestamp && (
              <span className="text-zinc-500 shrink-0">[{log.timestamp}]</span>
            )}
            <span
              className={cn(
                "shrink-0 uppercase font-bold text-[10px] mt-1 px-1 rounded bg-white/5",
                getLogColor(log.level),
              )}
            >
              {log.level}
            </span>
            <span
              className={cn(
                "break-all",
                log.level === "error"
                  ? "text-red-300"
                  : log.colorClass || "text-zinc-200",
              )}
            >
              {log.message}
            </span>
          </div>
        ))}
        {state === "loading" && (
          <div className="flex items-center gap-2 text-blue-400 animate-pulse mt-2">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            <span>Streaming logs...</span>
          </div>
        )}
      </div>
    </div>
  );
}
