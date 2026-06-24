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

const PROGRESS_PHASE_LABELS: Record<string, string> = {
  pull: "pull from source",
  push: "push to target",
  done: "complete",
  finalize: "finalizing",
  verify: "verifying paths",
  invalidate: "invalidating CDN",
  "pulling from source": "pull from source",
  "pushing to target": "push to target",
};

function formatProgressPhase(raw: string | undefined): string | null {
  if (!raw) return null;
  const key = raw.split(" — ")[0].trim().toLowerCase();
  return PROGRESS_PHASE_LABELS[key] || key;
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

  const handleLegendWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
      if (legendRef.current) {
        legendRef.current.scrollLeft += e.deltaY;
      }
    }
  };

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
    const filteredLogs = logs.filter((l) => !l.message.includes("[PROGRESS]"));
    const processed = filteredLogs.map((log) => {
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

  const [simProgress, setSimProgress] = React.useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [gameMap, checkOverflow]);

  useEffect(() => {
    if (state !== "loading") {
      setSimProgress({});
      return;
    }

    const interval = setInterval(() => {
      setSimProgress((prev) => {
        const next = { ...prev };
        Array.from(gameMap.keys()).forEach((gName) => {
          const lowerGName = gName.toLowerCase();
          const gLogs = logs.filter((l) =>
            l.message.toLowerCase().includes(lowerGName),
          );
          const progressLog = gLogs
            .filter((l) => l.message.includes("[PROGRESS]"))
            .pop();
          const lastMsg = gLogs[gLogs.length - 1]?.message.toLowerCase() || "";

          const isComp = gLogs.some((l) => {
            const m = l.message.toLowerCase();
            return (
              m.includes("syncing completed") ||
              m.includes(" : success") ||
              (m.includes("[progress]") && m.includes("100%"))
            );
          });

          if (isComp) {
            next[gName] = 100;
          } else if (progressLog) {
            const match = progressLog.message.match(/(\d+)%/);
            if (match) {
              next[gName] = Number.parseInt(match[1], 10);
            }
          } else {
            const isAct = gLogs.some((l) => {
              const m = l.message.toLowerCase();
              return (
                m.includes(`deploying`) ||
                m.includes("syncing from") ||
                m.includes("connecting") ||
                m.includes("invalidating") ||
                m.includes("taking") ||
                m.includes("verifying deployment") ||
                m.includes(": still ")
              );
            });

            if (isAct) {
              // No simulation for syncing - wait for real [PROGRESS] logs
            } else {
              next[gName] = 0;
            }
          }
        });
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [state, logs, gameMap]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-white/10 overflow-hidden shadow-xl">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-6 overflow-hidden flex-1">
          <div className="flex items-center gap-2 shrink-0">
            <Terminal className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-mono font-medium text-zinc-300 uppercase tracking-wider mr-1">
              Terminal
            </span>
          </div>

          {/* Game Legend */}
          {gameMap.size > 0 && (
            <div className="relative flex-1 overflow-hidden flex items-center">
              <div
                ref={legendRef}
                onScroll={checkOverflow}
                onWheel={handleLegendWheel}
                className="flex items-center gap-6 overflow-x-auto no-scrollbar py-1 scroll-smooth"
              >
                <div className="w-px h-4 bg-white/10 shrink-0" />
                {Array.from(gameMap.entries()).map(([name, colors], index) => {
                  const lowerName = name.toLowerCase();
                  const gLogs = logs.filter((l) =>
                    l.message.toLowerCase().includes(lowerName),
                  );
                  const isCompleted = gLogs.some((l) => {
                    const m = l.message.toLowerCase();
                    return (
                      m.includes("syncing completed") ||
                      m.includes(" : success") ||
                      (m.includes("[progress]") && m.includes("100%"))
                    );
                  });
                  const isActive =
                    !isCompleted &&
                    gLogs.some((l) => {
                      const m = l.message.toLowerCase();
                      return (
                        m.includes(`deploying`) ||
                        m.includes("syncing from") ||
                        m.includes("connecting") ||
                        m.includes("invalidating") ||
                        m.includes("taking") ||
                        m.includes("verifying deployment") ||
                        m.includes(": still ")
                      );
                    });

                  const stepProgress = Math.floor(simProgress[name] || 0);
                  const latestProgressLog = gLogs
                    .filter((l) => l.message.includes("[PROGRESS]"))
                    .pop();
                  const phaseMatch = latestProgressLog?.message.match(
                    /\(\s*([^)]+)\s*\)/,
                  );
                  const phaseHint = formatProgressPhase(phaseMatch?.[1]);
                  const showPercentage = isActive && stepProgress > 0;

                  return (
                    <React.Fragment key={name}>
                      {index > 0 && (
                        <div className="w-px h-3 bg-white/20 shrink-0" />
                      )}
                      <div
                        className={cn(
                          "flex items-center gap-2 shrink-0 animate-in fade-in slide-in-from-left-2 duration-300 transition-opacity",
                          !isActive && !isCompleted && state === "loading"
                            ? "opacity-40"
                            : "opacity-100",
                        )}
                        title={
                          phaseHint
                            ? `${name} — ${stepProgress}% — ${phaseHint}`
                            : name
                        }
                      >
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full shadow-sm relative",
                            colors.bg,
                            isActive &&
                              state === "loading" &&
                              "animate-pulse ring-4 ring-white/10",
                          )}
                        >
                          {isCompleted && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -inset-1 rounded-full border border-white/50 bg-white/20"
                            />
                          )}
                        </div>
                        <span
                          className={cn(
                            "text-xs font-bold uppercase tracking-wider flex items-center gap-1.5",
                            colors.text,
                          )}
                        >
                          {name}
                          {showPercentage &&
                            (stepProgress > 0 || isCompleted) && (
                              <span className="text-[9px] opacity-70 tabular-nums whitespace-nowrap">
                                ({stepProgress}%
                                {phaseHint && !isCompleted
                                  ? ` · ${phaseHint}`
                                  : ""}
                                )
                              </span>
                            )}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })}
                {/* Spacer at the end for the persistent indicator */}
                <div className="w-4 shrink-0" />
              </div>

              <div
                className={cn(
                  "absolute -right-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none transition-opacity duration-300",
                  showOverflow ? "opacity-100" : "opacity-0",
                )}
              >
                <div className="flex items-center bg-black/50 rounded-full h-8 px-2 border border-white/10 shadow-md backdrop-blur-md">
                  <div className="flex items-center h-4">
                    <div
                      className="w-[30px] h-full overflow-hidden relative shrink-0"
                      style={{
                        maskImage:
                          "linear-gradient(to right, black 30%, transparent 100%)",
                        WebkitMaskImage:
                          "linear-gradient(to right, black 30%, transparent 100%)",
                      }}
                    >
                      <motion.div
                        className="flex items-center h-full absolute left-0"
                        animate={{ x: [-50, 0] }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        style={{ width: "100px", gap: "4px" }}
                      >
                        {[
                          "#f97316",
                          "#a855f7",
                          "#06b6d4",
                          "#d8b4fe",
                          "#3b82f6",
                          "#f97316",
                          "#a855f7",
                          "#06b6d4",
                          "#d8b4fe",
                          "#3b82f6",
                        ].map((color, i) => (
                          <div
                            key={i}
                            className="rounded-full shrink-0"
                            style={{
                              backgroundColor: color,
                              width: "6px",
                              height: "6px",
                            }}
                          />
                        ))}
                      </motion.div>
                    </div>
                    <motion.div
                      animate={{ x: [0, 2, 0], opacity: [0.6, 1, 0.6] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="flex items-center -ml-4 relative z-10"
                    >
                      <ChevronRight className="w-7 h-7 text-primary" />
                    </motion.div>
                  </div>
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
                "break-all whitespace-pre-wrap",
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
