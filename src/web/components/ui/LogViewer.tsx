import React, { useEffect, useRef } from "react";
import {
  Terminal,
  Download,
  ChevronUp,
  ChevronDown,
  Trash2,
} from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

interface LogEntry {
  level: string;
  message: string;
  timestamp?: string;
}

interface LogViewerProps {
  logs: LogEntry[];
  state: "idle" | "loading" | "done" | "error";
  onClear?: () => void;
  onDownload?: () => void;
}

export function LogViewer({
  logs,
  state,
  onClear,
  onDownload,
}: LogViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

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

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-white/10 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-mono font-medium text-zinc-300 uppercase tracking-wider">
            Deployment Terminal
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-zinc-400 hover:text-white"
            onClick={() => setAutoScroll(!autoScroll)}
          >
            {autoScroll ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </Button>
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
        className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed scrollbar-thin scrollbar-thumb-white/10"
      >
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2 opacity-50">
            <Terminal className="w-8 h-8" />
            <p>Waiting for deployment logs...</p>
          </div>
        )}
        {logs.map((log, index) => (
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
                log.level === "error" ? "text-red-300" : "text-zinc-200",
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
