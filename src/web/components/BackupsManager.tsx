import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  RefreshCcw,
  Trash2,
  Calendar,
  HardDrive,
  Clock,
  AlertTriangle,
  Download,
  Database,
  Search,
  ChevronRight,
  ChevronDown,
  Edit2,
  Check,
  X,
  Gamepad2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";
import { cn } from "../lib/utils";
import { getApiUrl } from "../api";

interface Backup {
  name: string;
  path: string;
  timestamp: string;
  environment: string;
  deploymentVersion: string;
  deploymentStatus: string;
  backupSizeBytes: number;
  backupSizeHuman: string;
  createdAt: string;
}

export function BackupsManager() {
  const [selectedEnv, setSelectedEnv] = useState<"dev" | "qa" | "preprod">(
    "dev",
  );
  const [backups, setBackups] = useState<Backup[]>([]);
  const [gameMap, setGameMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGames, setExpandedGames] = useState<string[]>([]);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [deleteModalTarget, setDeleteModalTarget] = useState<Backup | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState("");
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameProgress, setRenameProgress] = useState(0);
  const [renameStatus, setRenameStatus] = useState("");
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    type: "info" | "warning" | "error" | "success" | "confirm";
    onConfirm?: () => void;
  }>({ isOpen: false, title: "", type: "info" });

  const eventSourceRef = React.useRef<EventSource | null>(null);

  const fetchData = useCallback((env: string) => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setLoading(true);
    setError(null);
    setBackups([]); // clear old before streaming new

    // Fetch config for the gameMap dropdown
    fetch(getApiUrl("/api/config"))
      .then((r) => r.json())
      .then((d) => setGameMap(d.gameFolderMap || {}))
      .catch(() => {});

    const eventSource = new EventSource(getApiUrl(`/api/backups/stream?env=${env}`));
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (e) => {
      try {
        const backup = JSON.parse(e.data);
        setBackups((prev) => {
          // Prevent duplicates
          if (prev.some((p) => p.path === backup.path)) return prev;
          return [...prev, backup].sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          );
        });
      } catch (err) {}
    };

    eventSource.addEventListener("end", () => {
      eventSource.close();
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null;
        setLoading(false);
      }
    });

    eventSource.onerror = (e) => {
      eventSource.close();
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null;
        setLoading(false);
        setBackups((prev) => {
          if (prev.length === 0) setError("Failed to stream backups.");
          return prev;
        });
      }
    };
  }, []);

  useEffect(() => {
    fetchData(selectedEnv);
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [selectedEnv, fetchData]);

  const confirmDelete = async () => {
    if (!deleteModalTarget) return;
    setIsDeleting(true);
    setDeleteProgress(0);
    setDeleteStatus("Initializing secure connection...");

    // Smooth progress simulation
    const progressInterval = setInterval(() => {
      setDeleteProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 5;
      });
    }, 200);

    try {
      setTimeout(() => setDeleteStatus("Locating snapshot on server..."), 800);
      setTimeout(() => setDeleteStatus("Permanently removing files..."), 1600);

      const res = await fetch(getApiUrl("/api/backups"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          env: selectedEnv,
          path: deleteModalTarget.path,
        }),
      });

      clearInterval(progressInterval);
      if (!res.ok) throw new Error("Failed to delete backup");

      setDeleteProgress(100);
      setDeleteStatus("Snapshot removed successfully!");

      // Update state locally
      setBackups((prev) =>
        prev.filter((b) => b.path !== deleteModalTarget.path),
      );

      setTimeout(() => {
        setDeleteModalTarget(null);
        setDeleteStatus("");
        setDeleteProgress(0);
      }, 500);
    } catch (err: any) {
      clearInterval(progressInterval);
      setModal({
        isOpen: true,
        title: "Deletion Failed",
        description: err.message,
        type: "error",
      });
      setDeleteStatus("");
      setDeleteProgress(0);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = (backup: Backup) => {
    setDeleteModalTarget(backup);
  };

  const handleRename = async (backup: Backup) => {
    if (!newName.trim() || newName === backup.name) {
      setEditingPath(null);
      return;
    }
    setIsRenaming(true);
    setRenameProgress(0);
    setRenameStatus("Preparing...");

    const progressInterval = setInterval(() => {
      setRenameProgress((prev) => {
        if (prev < 30) {
          setRenameStatus("Contacting server...");
          return prev + Math.random() * 10;
        }
        if (prev < 70) {
          setRenameStatus("Updating filesystem...");
          return prev + Math.random() * 5;
        }
        if (prev < 90) {
          setRenameStatus("Finalizing...");
          return prev + Math.random() * 2;
        }
        return prev;
      });
    }, 200);

    try {
      const res = await fetch(getApiUrl("/api/backups"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          env: selectedEnv,
          oldPath: backup.path,
          newName: newName.trim(),
        }),
      });

      clearInterval(progressInterval);
      if (!res.ok) throw new Error("Failed to rename backup");

      setRenameProgress(100);
      setRenameStatus("Renamed successfully!");

      // Update state locally
      setBackups((prev) =>
        prev.map((b) => {
          if (b.path === backup.path) {
            const parentDir = b.path.substring(0, b.path.lastIndexOf("/"));
            const newPath = parentDir + "/" + newName.trim();
            return { ...b, name: newName.trim(), path: newPath };
          }
          return b;
        }),
      );

      setTimeout(() => {
        setEditingPath(null);
        setRenameProgress(0);
        setRenameStatus("");
      }, 500);
    } catch (err: any) {
      clearInterval(progressInterval);
      setModal({
        isOpen: true,
        title: "Rename Failed",
        description: err.message,
        type: "error",
      });
    } finally {
      setIsRenaming(false);
    }
  };

  const groupedBackups = useMemo(() => {
    const groups: Record<string, Backup[]> = { "Core & Others": [] };
    const games = Object.keys(gameMap);

    backups.forEach((backup) => {
      // Sort games by path length descending so longer paths match first
      const sortedGames = [...games].sort(
        (a, b) => gameMap[b].path.length - gameMap[a].path.length,
      );
      let matchedGame = sortedGames.find(
        (g) =>
          backup.name.startsWith(gameMap[g].path + "_") ||
          backup.name.startsWith(gameMap[g].path + "-"),
      );

      if (matchedGame) {
        if (!groups[matchedGame]) groups[matchedGame] = [];
        groups[matchedGame].push(backup);
      } else {
        groups["Core & Others"].push(backup);
      }
    });

    return groups;
  }, [backups, gameMap]);

  const toggleGame = (game: string) => {
    setExpandedGames((prev) =>
      prev.includes(game) ? prev.filter((g) => g !== game) : [...prev, game],
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-black/20 rounded-xl border border-white/5">
            {["dev", "qa", "preprod"].map((env) => (
              <button
                key={env}
                onClick={() => setSelectedEnv(env as any)}
                className={cn(
                  "px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                  selectedEnv === env
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {env}
              </button>
            ))}
          </div>
          <div className="h-8 w-px bg-white/10 mx-2" />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchData(selectedEnv)}
            disabled={loading}
            className="gap-2 h-9 border-white/10 bg-white/5"
          >
            <RefreshCcw
              className={cn("w-3.5 h-3.5", loading && "animate-spin")}
            />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search snapshots..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64 bg-black/20 border-white/10 h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {loading && backups.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-2 bg-primary/5 border border-primary/20 rounded-xl text-[11px] text-primary/80 font-black uppercase tracking-widest"
        >
          <RefreshCcw className="w-3 h-3 animate-spin" />
          Synchronizing snapshots in real-time...
        </motion.div>
      )}

      {error ? (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="flex items-center gap-3 p-6 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <p>{error}</p>
          </CardContent>
        </Card>
      ) : loading && backups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="p-4 rounded-full bg-primary/10 animate-pulse">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <p className="text-zinc-500 animate-pulse">
            Scanning server for snapshots...
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedBackups)
            .filter(([game, list]) => list.length > 0)
            .sort(([a], [b]) =>
              a === "Core & Others" ? -1 : a.localeCompare(b),
            )
            .map(([game, list]) => {
              const isExpanded = expandedGames.includes(game);
              const filteredList = list.filter(
                (b) =>
                  (b.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
                  (b.deploymentVersion?.toLowerCase() || "").includes(searchQuery.toLowerCase()),
              );

              if (searchQuery && filteredList.length === 0) return null;

              return (
                <Card
                  key={game}
                  className={cn(
                    "overflow-hidden border-white/5 transition-all",
                    isExpanded
                      ? "bg-zinc-900/40"
                      : "bg-zinc-900/20 hover:bg-zinc-900/30",
                  )}
                >
                  <button
                    onClick={() => toggleGame(game)}
                    className="w-full px-5 py-4 flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          isExpanded
                            ? "bg-primary/20 text-primary"
                            : "bg-white/5 text-zinc-500 group-hover:text-zinc-300",
                        )}
                      >
                        {game === "Core & Others" ? (
                          <Database className="w-5 h-5" />
                        ) : (
                          <Gamepad2 className="w-5 h-5" />
                        )}
                      </div>
                      <div className="text-left">
                        <h3 className="font-bold text-zinc-200 group-hover:text-white transition-colors">
                          {game}
                        </h3>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black mt-0.5">
                          {list.length} Snapshots Available
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-zinc-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-zinc-600" />
                      )}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5 bg-black/20"
                      >
                        <div className="p-2 space-y-1">
                          {filteredList.map((backup) => (
                            <div
                              key={backup.path}
                              className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 group/item transition-all"
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover/item:bg-primary transition-colors" />
                                {editingPath === backup.path ? (
                                  <div className="flex items-center gap-2 flex-1 max-w-sm">
                                    <div className="relative flex-1">
                                      <Input
                                        value={newName}
                                        onChange={(e) =>
                                          setNewName(e.target.value)
                                        }
                                        className="h-8 py-1 px-2 text-xs bg-black/40 border-white/10 w-full"
                                        autoFocus
                                        disabled={isRenaming}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            handleRename(backup);
                                          if (e.key === "Escape")
                                            setEditingPath(null);
                                        }}
                                      />
                                      {isRenaming && (
                                        <div className="absolute inset-0 bg-black/80 rounded-md flex flex-col items-center justify-center px-2 z-10">
                                          <div className="flex items-center justify-between w-full mb-1">
                                            <span className="text-[8px] font-black uppercase tracking-tighter text-zinc-400">
                                              {renameStatus}
                                            </span>
                                            <span className="text-[9px] font-black text-primary tabular-nums">
                                              {Math.round(renameProgress)}%
                                            </span>
                                          </div>
                                          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                                            <motion.div
                                              initial={{ width: 0 }}
                                              animate={{
                                                width: `${renameProgress}%`,
                                              }}
                                              className="h-full bg-primary"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => handleRename(backup)}
                                        disabled={isRenaming}
                                        className="p-1.5 text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors disabled:opacity-50"
                                      >
                                        {isRenaming ? (
                                          <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Check className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                      <button
                                        onClick={() => setEditingPath(null)}
                                        disabled={isRenaming}
                                        className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-zinc-300 truncate">
                                        {backup.name}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingPath(backup.path);
                                          setNewName(backup.name);
                                        }}
                                        className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
                                      >
                                        <Edit2 className="w-3 h-3 text-zinc-500" />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-zinc-500 font-mono">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(
                                          backup.timestamp,
                                        ).toLocaleDateString()}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {new Date(
                                          backup.timestamp,
                                        ).toLocaleTimeString()}
                                      </span>
                                      <span className="text-primary/70 font-bold">
                                        {backup.backupSizeHuman}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-zinc-500 hover:text-white border-white/5 hover:bg-white/5"
                                  onClick={() =>
                                    window.open(backup.path, "_blank")
                                  }
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 text-red-400/60 hover:text-red-400 border-white/5 hover:bg-red-400/10"
                                  onClick={() => handleDeleteClick(backup)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}
        </div>
      )}

      <AnimatePresence>
        {deleteModalTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteModalTarget(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 text-red-500">
                  <AlertCircle className="w-8 h-8" />
                </div>

                <h3 className="text-xl font-bold text-center text-zinc-100 mb-2">
                  Delete Snapshot?
                </h3>
                <p className="text-sm text-center text-zinc-500 mb-8 px-4">
                  This action cannot be undone. All data in this backup will be
                  permanently removed.
                </p>

                <div className="bg-black/40 rounded-2xl p-5 border border-white/5 space-y-4 mb-8">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-0.5">
                        Filename
                      </p>
                      <p className="text-sm font-medium text-zinc-200 truncate">
                        {deleteModalTarget.name}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-0.5">
                        Size
                      </p>
                      <p className="text-sm font-bold text-primary">
                        {deleteModalTarget.backupSizeHuman}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500 mb-0.5">
                        Created
                      </p>
                      <p className="text-sm font-medium text-zinc-300">
                        {new Date(
                          deleteModalTarget.timestamp,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className={cn(
                      "w-full transition-all duration-500 text-base font-bold relative overflow-hidden",
                      isDeleting
                        ? "bg-zinc-900/50 border border-white/5 text-zinc-400 py-4 h-auto"
                        : "bg-red-600 hover:bg-red-500 text-white border-none shadow-[0_0_20px_rgba(220,38,38,0.2)] py-7 h-16",
                    )}
                  >
                    {isDeleting ? (
                      <div className="flex flex-col items-center gap-2 w-full px-4">
                        <div className="flex items-center justify-between w-full mb-1.5">
                          <div className="flex items-center gap-2.5">
                            <RefreshCcw className="w-4 h-4 animate-spin text-primary" />
                            <span className="text-[13px] font-bold text-zinc-100 tracking-tight">
                              Deleting Snapshot...
                            </span>
                          </div>
                          <span className="text-xs font-black text-primary tabular-nums">
                            {Math.round(deleteProgress)}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/5 shadow-inner">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${deleteProgress}%` }}
                            className="h-full bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)]"
                          />
                        </div>
                        <span className="text-[9px] text-zinc-500 animate-pulse font-black mt-1.5 uppercase tracking-[0.2em]">
                          {deleteStatus}
                        </span>
                      </div>
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5 mr-2" />
                        Delete Snapshot
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteModalTarget(null)}
                    disabled={isDeleting}
                    className="w-full text-zinc-500 hover:text-zinc-300 py-4"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
