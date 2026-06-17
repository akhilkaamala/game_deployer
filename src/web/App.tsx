import { FormEvent, useEffect, useMemo, useState, useCallback } from "react";
import { deploy, fetchConfig, stopProcess, streamGameSizes } from "./api";
import type { ConfigResponse, DeployEnvironment } from "./types";
import { Layout } from "./components/Layout";
import { EnvironmentSelection } from "./components/EnvironmentSelection";
import { GameSelector } from "./components/ui/GameSelector";
import { DeploymentSummary } from "./components/DeploymentSummary";
import { LogViewer } from "./components/ui/LogViewer";
import {
  DeploymentStepper,
  StepStatus,
} from "./components/ui/DeploymentStepper";
import { StatusChips } from "./components/StatusChips";
import { Button } from "./components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./components/ui/Card";
import { loadPrefs, UIPrefs } from "./components/Settings";
import { Checkbox } from "./components/ui/Checkbox";
import { Input } from "./components/ui/Input";
import { Badge } from "./components/ui/Badge";
import {
  Rocket,
  Play,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Settings2,
  Trash2,
  Download,
  Database,
  HelpCircle,
  Terminal as TerminalIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "./lib/utils";

import { ContentFolderCard } from "./components/ui/ContentFolderCard";

type DeployState = "idle" | "loading" | "done" | "error";

export function App() {
  const initialPrefs = loadPrefs();
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [sourceEnv, setSourceEnv] = useState<DeployEnvironment>(
    initialPrefs.defaultSourceEnv as any,
  );
  const [targetEnv, setTargetEnv] = useState<DeployEnvironment>(
    initialPrefs.defaultTargetEnv as any,
  );
  const [retain, setRetain] = useState<string>("");
  const [backupGames, setBackupGames] = useState<string[]>([]);
  const [gamePaths, setGamePaths] = useState<string[]>([]);
  const [dryRun, setDryRun] = useState<boolean>(initialPrefs.dryRunDefault);
  const [logs, setLogs] = useState<
    { level: string; message: string; timestamp?: string }[]
  >([]);
  const [gameSizes, setGameSizes] = useState<Record<string, number>>({});
  const [loadingSizes, setLoadingSizes] = useState(false);
  const [state, setState] = useState<DeployState>("idle");

  // Stepper state
  const [steps, setSteps] = useState([
    {
      id: "backup",
      label: "Environment Backup",
      status: "pending" as StepStatus,
    },
    {
      id: "validation",
      label: "Pre-deployment Validation",
      status: "pending" as StepStatus,
    },
    {
      id: "transfer",
      label: "Secure Data Transfer",
      status: "pending" as StepStatus,
    },
    {
      id: "sync",
      label: "JSON Manifest Sync",
      status: "pending" as StepStatus,
    },
    {
      id: "verification",
      label: "Deployment Verification",
      status: "pending" as StepStatus,
    },
    {
      id: "cleanup",
      label: "Workspace Cleanup",
      status: "pending" as StepStatus,
    },
  ]);

  const gamesList = useMemo(() => {
    if (!config?.gameFolderMap) return [];
    return Object.keys(config.gameFolderMap);
  }, [config]);

  const toggleGame = useCallback((game: string) => {
    setGamePaths((prev) =>
      prev.includes(game) ? prev.filter((g) => g !== game) : [...prev, game],
    );
  }, []);

  const toggleBackup = useCallback((game: string) => {
    setBackupGames((prev) =>
      prev.includes(game) ? prev.filter((g) => g !== game) : [...prev, game],
    );
  }, []);

  const selectAll = useCallback((games: string[]) => {
    setGamePaths(games);
  }, []);

  const deselectAll = useCallback(() => {
    setGamePaths([]);
    setBackupGames([]);
  }, []);

  const handleResetAll = useCallback(() => {
    setSourceEnv("dev");
    setTargetEnv("qa");
    setGamePaths([]);
    setBackupGames([]);
    setLogs([]);
    setState("idle");
    // Reset steps to initial pending state
    setSteps([
      {
        id: "validation",
        label: "Pre-deployment Validation",
        status: "pending",
      },
      { id: "backup", label: "Environment Backup", status: "pending" },
      { id: "transfer", label: "Secure Data Transfer", status: "pending" },
      { id: "manifest", label: "JSON Manifest Sync", status: "pending" },
      {
        id: "verification",
        label: "Deployment Verification",
        status: "pending",
      },
      { id: "cleanup", label: "Workspace Cleanup", status: "pending" },
    ]);
  }, []);

  const loadConfig = useCallback((isInitial = false) => {
    fetchConfig()
      .then((data) => {
        setConfig(data);
        if (isInitial && data.gameFolderMap) {
          const keys = Object.keys(data.gameFolderMap);
          const prefs = loadPrefs();
          if (keys.length > 0 && prefs.autoSelectFirstGame) {
            setGamePaths([keys[0]]);
          }
        }
      })
      .catch((error: Error) => {
        setState("error");
        setLogs([
          {
            level: "error",
            message: error.message,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      });

    setLoadingSizes(true);
    const stopStream = streamGameSizes(
      (folder, size) => {
        setGameSizes((prev) => ({
          ...prev,
          [folder]: size,
          [folder.toLowerCase()]: size,
        }));
      },
      () => {
        setLoadingSizes(false);
      },
    );
    return () => stopStream();
  }, []);

  // Initial load
  useEffect(() => {
    loadConfig(true);
  }, [loadConfig]);

  // Re-fetch whenever Games Manager saves a change
  useEffect(() => {
    const handler = () => {
      console.log("Detected game catalog update, re-fetching config...");
      loadConfig(false);
    };
    window.addEventListener("gamesConfigUpdated", handler);
    return () => window.removeEventListener("gamesConfigUpdated", handler);
  }, [loadConfig]);

  // Sync with Settings changes
  useEffect(() => {
    const handler = (e: any) => {
      const p = e.detail as UIPrefs;
      if (p.defaultSourceEnv) setSourceEnv(p.defaultSourceEnv as any);
      if (p.defaultTargetEnv) setTargetEnv(p.defaultTargetEnv as any);
      setDryRun(p.dryRunDefault);
      setBackupGames([]);

      // Handle auto-select change
      if (p.autoSelectFirstGame && config?.gameFolderMap) {
        setGamePaths((prev) => {
          if (prev.length === 0) {
            const keys = Object.keys(config.gameFolderMap);
            return keys.length > 0 ? [keys[0]] : [];
          }
          return prev;
        });
      }
    };
    window.addEventListener("settingsUpdated", handler);
    return () => window.removeEventListener("settingsUpdated", handler);
  }, [config]);

  // Handle Auto-shutdown on Exit
  useEffect(() => {
    const handleUnload = () => {
      // Safeguard: Only auto-shutdown in production, never in dev mode
      if (import.meta.env.DEV) return;

      const prefs = loadPrefs();
      if (prefs.autoShutdownOnExit) {
        const API_BASE = import.meta.env.VITE_API_URL || "";
        navigator.sendBeacon(`${API_BASE}/api/shutdown`);
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  const updateStep = (id: string, status: StepStatus) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, status } : step)),
    );
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setState("loading");
    setLogs([]);

    // Reset steps
    setSteps(steps.map((s) => ({ ...s, status: "pending" })));

    const API_BASE = import.meta.env.VITE_API_URL || "";
    const eventSource = new EventSource(`${API_BASE}/api/logs`);
    eventSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      const timestamp = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev, { ...data, timestamp }]);

      // Robust stage tracking based on backend log markers
      const msg = data.message.toLowerCase();

      // 1. Validation / Connection
      if (msg.includes("connecting")) updateStep("validation", "running");
      if (msg.includes("connected")) updateStep("validation", "success");

      // 2. Backup
      if (
        msg.includes("starting backup") ||
        msg.includes("taking backup") ||
        msg.includes("creating backup")
      )
        updateStep("backup", "running");
      if (
        msg.includes("backup completed") ||
        msg.includes("backup successful") ||
        msg.includes("skipping game backup") ||
        msg.includes("skipping json backup")
      )
        updateStep("backup", "success");

      // 3. Data Transfer
      if (msg.includes("syncing from")) updateStep("transfer", "running");
      if (msg.includes("syncing completed")) updateStep("transfer", "success");

      // 4. Manifest Sync
      if (msg.includes("syncing json")) updateStep("manifest", "running");
      if (msg.includes("synced json")) updateStep("manifest", "success");

      // 5. Verification
      if (msg.includes("invalidating")) updateStep("verification", "running");
      if (msg.includes("invalidating completed"))
        updateStep("verification", "success");

      // 6. Cleanup
      if (msg.includes("cleanup") && !msg.includes("completed"))
        updateStep("cleanup", "running");
      if (msg.includes("cleanup completed")) updateStep("cleanup", "success");
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      eventSource.close();
    };

    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const retainNumber = retain.trim()
        ? Number.parseInt(retain.trim(), 10)
        : null;

      // Artificial step updates if logs don't trigger them clearly
      updateStep("validation", "running");

      await deploy({
        sourceEnv,
        targetEnv,
        retain: Number.isInteger(retainNumber) ? retainNumber : null,
        dryRun,
        gamePath: gamePaths.length > 0 ? gamePaths.join(",") : null,
        backupGames: backupGames.length > 0 ? backupGames.join(",") : null,
      });

      setState("done");
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "running" ? { ...s, status: "success" } : s,
        ),
      );
      // Mark all as success for now if done
      setSteps((prev) => prev.map((s) => ({ ...s, status: "success" })));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setState("error");
      setLogs((prev) => [
        ...prev,
        { level: "error", message, timestamp: new Date().toLocaleTimeString() },
      ]);
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "running" ? { ...s, status: "error" } : s,
        ),
      );
    } finally {
      eventSource.close();
    }
  }

  const downloadReport = () => {
    const content = logs
      .map((l) => `[${l.timestamp}] ${l.level.toUpperCase()}: ${l.message}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deployment-report-${new Date().toISOString()}.txt`;
    a.click();
  };

  const handleStop = async () => {
    try {
      await stopProcess();
      setLogs((prev) => [
        ...prev,
        {
          level: "warn",
          message: "STOP REQUESTED: Killing all active processes...",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (error: any) {
      setLogs((prev) => [
        ...prev,
        {
          level: "error",
          message: `Stop request failed: ${error.message}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  return (
    <Layout>
      <div className="flex justify-end mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetAll}
          className="gap-2 border-white/10 bg-white/5 hover:bg-white/10 hover:text-white transition-all group"
        >
          <RotateCcw className="w-4 h-4 group-active:rotate-[-180deg] transition-transform duration-300" />
          Reset All
        </Button>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column: Configuration */}
        <div className="xl:col-span-7 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <EnvironmentSelection
              source={sourceEnv}
              target={targetEnv}
              onSourceChange={(env) => {
                setSourceEnv(env);
                if (env === "dev") setTargetEnv("qa");
                else if (env === "qa") setTargetEnv("preprod");
                else if (env === "preprod") setTargetEnv("dev");
              }}
              onTargetChange={setTargetEnv}
              availableEnvironments={config?.environments ?? []}
              isDeploying={state === "loading"}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
          >
            <ContentFolderCard
              isSelected={gamePaths.includes("content")}
              isBackupEnabled={backupGames.includes("content")}
              onToggle={() => toggleGame("content")}
              onToggleBackup={() => toggleBackup("content")}
              isDeploying={state === "loading"}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="border-white/10 bg-white/5 backdrop-blur-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">
                      Game Selection
                    </CardTitle>
                    <CardDescription>
                      Select games to deploy to the target environment
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="h-6">
                    {gamePaths.length} SELECTED
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="h-[800px]">
                <GameSelector
                  games={gamesList}
                  selectedGames={gamePaths}
                  backupGames={backupGames}
                  gameFolderMap={config?.gameFolderMap ?? {}}
                  gameSizes={gameSizes}
                  loadingSizes={loadingSizes}
                  onToggle={toggleGame}
                  onToggleBackup={toggleBackup}
                  onSelectAll={selectAll}
                  onDeselectAll={deselectAll}
                  onSelectBackups={(games) => setBackupGames(games)}
                  onDeselectBackups={() => setBackupGames([])}
                />
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Column: Status & Monitoring */}
        <div className="xl:col-span-5 space-y-8">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <DeploymentSummary
              source={sourceEnv}
              target={targetEnv}
              selectedGames={gamePaths}
              backupGames={backupGames}
              retention={retain}
              gameFolderMap={config?.gameFolderMap ?? {}}
              serverBasePaths={config?.serverBasePaths ?? {}}
              jsonRootPaths={config?.jsonRootPaths ?? {}}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="border-white/10 bg-white/5 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Backup & Safety
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Database className="w-4 h-4 text-primary" />
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        Retention Policy
                      </span>
                    </div>
                    <div className="relative group">
                      <Input
                        type="number"
                        min={1}
                        placeholder={String(
                          config?.retention?.[targetEnv] ?? "3",
                        )}
                        value={retain}
                        onChange={(e) => setRetain(e.target.value)}
                        className="bg-zinc-900/50 border-white/10 h-11 focus:ring-primary/50"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-zinc-500 font-bold">
                        SNAPSHOTS
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-amber-500/5 border border-amber-500/10 transition-colors hover:bg-amber-500/10">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-amber-200">
                            Dry Run Mode
                          </span>
                          <div className="relative group/info">
                            <HelpCircle className="w-3.5 h-3.5 text-amber-500/50 cursor-help" />
                            <div className="absolute left-0 bottom-full mb-2 w-64 p-3 rounded-lg bg-zinc-900 border border-white/10 shadow-2xl opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 pointer-events-none">
                              <div className="text-[10px] text-zinc-300 leading-relaxed space-y-1.5">
                                <p>
                                  <strong className="text-amber-400 block mb-0.5">
                                    Pre-flight Check:
                                  </strong>
                                  Validates paths, SSH keys, and server
                                  connectivity.
                                </p>
                                <p>
                                  <strong className="text-amber-400 block mb-0.5">
                                    Log Visibility:
                                  </strong>
                                  Shows exactly which files would be updated,
                                  added, or deleted in the terminal below.
                                </p>
                                <p className="text-emerald-400/80 font-bold">
                                  No real changes will be made.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-amber-500/60">
                          Validate without execution
                        </span>
                      </div>
                      <Checkbox
                        checked={dryRun}
                        onCheckedChange={(checked) => setDryRun(!!checked)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="border-white/10 bg-white/5 backdrop-blur-md">
              <CardHeader className="border-b border-white/10 bg-white/5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider">
                    Pipeline Progress
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    {state === "loading" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStop}
                        className="text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2 h-7 px-3 border border-red-500/20"
                      >
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        STOP DEPLOYMENT
                      </Button>
                    )}
                    <StatusChips status={state} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <DeploymentStepper steps={steps} />

                <div className="mt-8">
                  <Button
                    variant="deploy"
                    size="lg"
                    className="w-full h-14 text-lg font-bold gap-3 rounded-xl shadow-2xl relative overflow-hidden group"
                    disabled={state === "loading" || gamePaths.length === 0}
                    onClick={onSubmit}
                  >
                    <AnimatePresence mode="wait">
                      {state === "loading" ? (
                        <motion.div
                          key="loading"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex items-center gap-3"
                        >
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>DEPLOYING...</span>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="idle"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex items-center gap-3"
                        >
                          <Rocket className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                          <span>START DEPLOYMENT</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {state === "loading" && (
                      <motion.div
                        className="absolute inset-0 bg-white/20"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{
                          repeat: Infinity,
                          duration: 1.5,
                          ease: "linear",
                        }}
                      />
                    )}
                  </Button>
                  {gamePaths.length === 0 && (
                    <p className="text-center text-[10px] text-red-400 mt-2 font-medium">
                      Please select at least one game
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Full Width Terminal at Bottom */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 h-[450px] xl:col-span-12"
        >
          <LogViewer
            logs={logs}
            state={state}
            selectedGames={gamePaths}
            onClear={() => setLogs([])}
            onDownload={downloadReport}
          />
        </motion.div>
      </div>
    </Layout>
  );
}
