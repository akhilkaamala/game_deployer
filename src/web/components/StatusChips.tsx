import React from "react";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/utils";

interface StatusChipsProps {
  status: "idle" | "loading" | "done" | "error";
}

export function StatusChips({ status }: StatusChipsProps) {
  return (
    <div className="flex items-center gap-2">
      {status === "idle" && (
        <Badge variant="pending" className="gap-1.5 py-1 px-3 border-yellow-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
          READY
        </Badge>
      )}
      {status === "loading" && (
        <Badge variant="running" className="gap-1.5 py-1 px-3 border-blue-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
          EXECUTING
        </Badge>
      )}
      {status === "done" && (
        <Badge variant="success" className="gap-1.5 py-1 px-3 border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          SUCCESS
        </Badge>
      )}
      {status === "error" && (
        <Badge variant="destructive" className="gap-1.5 py-1 px-3 border-red-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          FAILED
        </Badge>
      )}
    </div>
  );
}
