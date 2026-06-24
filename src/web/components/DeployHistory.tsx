import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCcw,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  Server,
  User,
} from "lucide-react";
import { Card, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";
import { cn } from "../lib/utils";
import { getApiUrl } from "../api";

interface DeployReport {
  environment: string;
  sourceEnvironment?: string;
  deploymentVersion: string;
  gamePath: string | null;
  status: string;
  deployedAt: string;
  artifacts?: string;
  syncType?: string;
  error?: string;
  backupCreated?: any;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  deployedBy?: string;
  reports: DeployReport[];
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

export function DeployHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    type: "info" | "warning" | "error" | "success" | "confirm";
    onConfirm?: () => void;
  }>({ isOpen: false, title: "", type: "info" });

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/history"));
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleClearHistory = async () => {
    setModal({
      isOpen: true,
      title: "Clear History?",
      description:
        "Are you sure you want to clear all deployment history? This action cannot be undone.",
      type: "confirm",
      onConfirm: async () => {
        setModal((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(getApiUrl("/api/history"), {
            method: "DELETE",
          });
          if (res.ok) {
            setHistory([]);
          } else {
            throw new Error("Failed to clear history");
          }
        } catch (err: any) {
          setModal({
            isOpen: true,
            title: "Clear Failed",
            description: err.message,
            type: "error",
          });
        }
      },
    });
  };

  const filteredHistory = history.filter((entry) => {
    const q = searchQuery.toLowerCase();
    if (!entry.reports || !Array.isArray(entry.reports)) return false;
    return (
      entry.reports.some(
        (r) =>
          (r.environment?.toLowerCase() || "").includes(q) ||
          (r.gamePath?.toLowerCase() || "").includes(q) ||
          (r.deploymentVersion?.toLowerCase() || "").includes(q),
      ) || (entry.deployedBy?.toLowerCase() || "").includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Deploy History</h2>
            <p className="text-xs text-zinc-500">
              Review past deployment reports and status
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64 bg-zinc-900/50 border-white/10"
            />
          </div>
          <Button
            variant="outline"
            onClick={fetchHistory}
            disabled={loading}
            size="icon"
          >
            <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button
            variant="outline"
            onClick={handleClearHistory}
            className="gap-2 text-red-400 border-red-500/20 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </Button>
        </div>
      </div>

      {loading && history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
          <Clock className="w-10 h-10 text-zinc-700 mb-4" />
          <p className="text-zinc-500">Loading historical records...</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-white/5 rounded-2xl">
          <Layers className="w-12 h-12 text-zinc-700 mb-4" />
          <p className="text-zinc-500">No deployment records found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((entry) => (
            <Card
              key={entry.id}
              className={cn(
                "overflow-hidden transition-all duration-300 border-white/5 bg-zinc-900/20 hover:border-white/10",
                expandedId === entry.id &&
                  "border-primary/30 ring-1 ring-primary/20 bg-zinc-900/40",
              )}
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() =>
                  setExpandedId(expandedId === entry.id ? null : entry.id)
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "p-2.5 rounded-xl",
                        entry.summary.failed > 0
                          ? "bg-red-500/10 text-red-400"
                          : "bg-emerald-500/10 text-emerald-400",
                      )}
                    >
                      {entry.summary.failed > 0 ? (
                        <XCircle className="w-5 h-5" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm">
                          {entry.summary.total === 1
                            ? entry.reports[0].gamePath || "Core Files"
                            : `${entry.summary.total} Games Batch`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                          {entry.reports[0].sourceEnvironment || "LOCAL"}
                        </span>
                        <ArrowRight className="w-3 h-3 text-zinc-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
                          {entry.reports[0].environment}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(entry.timestamp).toLocaleDateString()}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        {entry.deployedBy && (
                          <>
                            <span className="flex items-center gap-1 text-primary/80">
                              <User className="w-3 h-3" />
                              {entry.deployedBy}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-zinc-700" />
                          </>
                        )}
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-black uppercase",
                            entry.summary.failed > 0
                              ? "bg-red-500/20 text-red-400"
                              : "bg-emerald-500/20 text-emerald-400",
                          )}
                        >
                          {entry.summary.failed > 0
                            ? `${entry.summary.failed} Failed`
                            : "Success"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {entry.deployedBy && (
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[10px] text-zinc-500 uppercase font-black">
                          Deployed By
                        </span>
                        <span className="text-xs font-semibold text-primary/80 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {entry.deployedBy}
                        </span>
                      </div>
                    )}
                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-[10px] text-zinc-500 uppercase font-black">
                        Session ID
                      </span>
                      <span className="text-xs font-mono text-zinc-400">
                        {entry.id.slice(-6)}
                      </span>
                    </div>
                    {expandedId === entry.id ? (
                      <ChevronUp className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    )}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {expandedId === entry.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className="px-4 pb-4 pt-0 border-t border-white/5 bg-black/20">
                      <div className="space-y-3 mt-4">
                        {entry.reports.map((report, rIdx) => (
                          <div
                            key={rIdx}
                            className="p-3 rounded-lg bg-white/5 border border-white/5"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    report.status === "success"
                                      ? "bg-emerald-500"
                                      : "bg-red-500",
                                  )}
                                />
                                <span className="text-xs font-bold">
                                  {report.gamePath || "Core Files"}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-zinc-500">
                                {report.deploymentVersion}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-[11px]">
                              <div>
                                <p className="text-zinc-500 uppercase tracking-tighter mb-1 font-black">
                                  Source → Target
                                </p>
                                <div className="flex items-center gap-1.5 text-zinc-300 font-bold">
                                  <span className="text-zinc-500">
                                    {report.sourceEnvironment?.toUpperCase() ||
                                      "LOCAL"}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-zinc-700" />
                                  <span className="text-primary">
                                    {report.environment?.toUpperCase() ||
                                      "OFFLINE"}
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="text-zinc-500 uppercase tracking-tighter mb-1 font-black">
                                  Sync Type
                                </p>
                                <p className="text-zinc-300">
                                  {report.syncType || "standard"}
                                </p>
                              </div>
                            </div>

                            {report.error && (
                              <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-[10px] whitespace-pre-wrap">
                                {report.error}
                              </div>
                            )}

                            {report.backupCreated && (
                              <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-400/80">
                                <CheckCircle2 className="w-3 h-3" />
                                Backup verified:{" "}
                                {report.backupCreated.path.split("/").pop()}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal((prev) => ({ ...prev, isOpen: false }))}
        title={modal.title}
        description={modal.description}
        type={modal.type}
        onConfirm={modal.onConfirm}
      />
    </div>
  );
}
