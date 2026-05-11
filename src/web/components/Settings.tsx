import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Shield,
  Sliders,
  Monitor,
  Info,
  FolderOpen,
  Clock,
  Moon,
  Sun,
  Download,
  Copy,
  Power,
  RefreshCw,
  Globe,
  Key,
  Terminal,
  Upload,
  Lock,
  Trash2,
  Plus,
  Search,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";
import { getApiUrl } from "../api";
import { cn } from "../lib/utils";

// LocalStorage key for all client-side preferences
const LS_KEY = "deployment_ui_prefs";

declare var __APP_VERSION__: string;

interface UIPrefs {
  theme: "dark" | "light";
  defaultSourceEnv: string;
  defaultTargetEnv: string;
  dryRunDefault: boolean;
  autoSelectFirstGame: boolean;
  gameBackupDefault: boolean;
  jsonBackupDefault: boolean;
  logAutoScroll: boolean;
  sshTimeoutMs: number;
  healthCheckInterval: number;
  autoShutdownOnExit: boolean;
}

interface ServerSettings {
  backupRetention: { qa: number; preprod: number; [key: string]: number };
  sourcePath: string;
}

const DEFAULT_PREFS: UIPrefs = {
  theme: "dark",
  defaultSourceEnv: "dev",
  defaultTargetEnv: "qa",
  dryRunDefault: false,
  autoSelectFirstGame: true,
  gameBackupDefault: false,
  jsonBackupDefault: false,
  logAutoScroll: true,
  sshTimeoutMs: 6000,
  healthCheckInterval: 30,
  autoShutdownOnExit: false,
};

function loadPrefs(): UIPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw
      ? { ...DEFAULT_PREFS, ...JSON.parse(raw) }
      : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(prefs: UIPrefs) {
  localStorage.setItem(LS_KEY, JSON.stringify(prefs));
}

// Section wrapper
function Section({
  icon: Icon,
  title,
  description,
  children,
  onSave,
  saving,
  saved,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  onSave?: () => void;
  saving?: boolean;
  saved?: boolean;
}) {
  return (
    <div>
      <Card className="border-white/5 bg-zinc-900/40 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">{title}</CardTitle>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {description}
                </p>
              </div>
            </div>
            {onSave && (
              <Button
                size="sm"
                onClick={onSave}
                disabled={saving}
                className="gap-2 h-8"
              >
                {saved ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />{" "}
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    {saving ? "Saving…" : "Save"}
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}

// Toggle row
function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-[11px] text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          "relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0",
          value ? "bg-primary" : "bg-white/10",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
            value && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

// Field row
function FieldRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
          {label}
        </label>
        {description && (
          <p className="text-[11px] text-zinc-500 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export function SettingsManager() {
  const [prefs, setPrefs] = useState<UIPrefs>(loadPrefs);
  const [serverSettings, setServerSettings] = useState<ServerSettings>({
    backupRetention: { qa: 3, preprod: 3 },
    sourcePath: "",
  });
  const [loadingServer, setLoadingServer] = useState(true);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    description?: string;
    type: "info" | "warning" | "error" | "success" | "confirm";
    onConfirm?: () => void;
    confirmText?: string;
  }>({ isOpen: false, title: "", type: "info" });
  const [serverSaving, setServerSaving] = useState(false);
  const [serverSaved, setServerSaved] = useState(false);
  const [uiSaved, setUiSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configJson, setConfigJson] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [envs, setEnvs] = useState<string[]>(["dev", "qa", "preprod"]);
  const [keyEnv, setKeyEnv] = useState("");
  const [keyContent, setKeyContent] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [keySuccess, setKeySuccess] = useState(false);
  const [linkedKeys, setLinkedKeys] = useState<Record<string, string>>({});
  const [editingEnv, setEditingEnv] = useState<string | null>(null);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [cleaningEnv, setCleaningEnv] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Prevent browser from opening files on drop
  useEffect(() => {
    const preventDefault = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  // Load system info
  useEffect(() => {
    fetch(getApiUrl("/api/system-health"))
      .then(r => r.json())
      .then(data => setSystemInfo(data.server))
      .catch(() => {});
  }, []);

  // Load server settings
  useEffect(() => {
    fetch(getApiUrl("/api/settings"))
      .then((r) => r.json())
      .then((data) => {
        setServerSettings({
          backupRetention: data.backupRetention,
          sourcePath: data.sourcePath,
        });
        // Merge uiSettings from server too if present
        if (data.uiSettings && Object.keys(data.uiSettings).length > 0) {
          setPrefs((p) => ({ ...p, ...data.uiSettings }));
        }
      })
      .catch(() => setError("Failed to load settings from server"))
      .finally(() => setLoadingServer(false));

    // Load config JSON for export preview
    fetch(getApiUrl("/api/config"))
      .then((r) => r.json())
      .then((d) => {
        setConfigJson(JSON.stringify(d, null, 2));
        const servers = Object.keys(d.servers || {});
        if (servers.length > 0) {
          setEnvs(servers);
        }
        const linked: Record<string, string> = {};
        Object.entries(d.servers || {}).forEach(([name, s]: [string, any]) => {
          if (s.key && !s.key.startsWith("./keys/")) linked[name] = s.key;
        });
        setLinkedKeys(linked);
      })
      .catch(() => {});
  }, []);

  const handleBrowse = async () => {
    setIsBrowsing(true);
    try {
      const res = await fetch(getApiUrl("/api/browse-key"));
      const data = await res.json();
      if (data.path) {
        setKeyContent(data.path);
      }
    } catch (e) {
      // Fallback: If server is not connected, open standard picker
      fileInputRef.current?.click();
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setKeyContent(file.name);
    }
  };

  const handleDrop = (e: React.DragEvent, env: string) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // On Mac, sometimes we can get the path from the file object in local environments
      // but usually we rely on the OS pasting it.
      // If a file is dropped, we set the name and show a hint.
      const file = files[0];
      setEditingEnv(env);
      setKeyContent(file.name);
    }
  };

  const updatePref = <K extends keyof UIPrefs>(key: K, value: UIPrefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const handleSaveKey = async (
    envOverride?: string,
    contentOverride?: string,
  ) => {
    const env = envOverride || keyEnv;
    const content = contentOverride || keyContent;
    if (!env || !content) return;
    setKeySaving(true);
    setKeyError("");
    setKeySuccess(false);
    try {
      const res = await fetch(getApiUrl(`/api/environments/${env}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: content }),
      });
      if (!res.ok) throw new Error("Failed to update key path");
      setKeySuccess(true);
      setKeyContent("");
      setEditingEnv(null);
      setLinkedKeys((prev) => ({ ...prev, [env]: content }));
    } catch (e: any) {
      setKeyError(e.message);
    } finally {
      setKeySaving(false);
    }
  };

  const handleRemoveKey = async (env: string) => {
    setModal({
      isOpen: true,
      title: "Remove Key Connection?",
      description: `Clear the .pem path for ${env.toUpperCase()}?`,
      type: "confirm",
      onConfirm: async () => {
        setModal((prev) => ({ ...prev, isOpen: false }));
        try {
          // Setting key to empty in config
          const res = await fetch(getApiUrl(`/api/environments/${env}`), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: "" }),
          });
          if (res.ok) {
            setLinkedKeys((prev) => {
              const next = { ...prev };
              delete next[env];
              return next;
            });
          }
        } catch (err) {
          console.error("Failed to remove key path", err);
        }
      },
    });
  };

  const handleSaveUI = () => {
    savePrefs(prefs);
    // Apply theme immediately
    document.documentElement.classList.toggle("dark", prefs.theme === "dark");
    // Notify rest of app
    window.dispatchEvent(new CustomEvent("settingsUpdated", { detail: prefs }));
    setUiSaved(true);
    setTimeout(() => setUiSaved(false), 2500);
  };

  const handleSaveServer = async () => {
    setServerSaving(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backupRetention: serverSettings.backupRetention,
          sourcePath: serverSettings.sourcePath,
        }),
      });
      if (!res.ok) throw new Error("Server returned an error");
      setServerSaved(true);
      setTimeout(() => setServerSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setServerSaving(false);
    }
  };

  const handleResetUI = () => {
    setPrefs({ ...DEFAULT_PREFS });
    savePrefs(DEFAULT_PREFS);
    setUiSaved(true);
    setTimeout(() => setUiSaved(false), 2500);
  };

  const handleExport = () => {
    const blob = new Blob([configJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deployment.config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(configJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCleanup = async (env: string) => {
    setCleaningEnv(env);
    try {
      const res = await fetch(getApiUrl("/api/backups/cleanup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env }),
      });
      const data = await res.json();
      if (res.ok) {
        setModal({
          isOpen: true,
          title: "Cleanup Successful",
          description: `Removed ${data.report?.deletedCount || 0} old backups from ${env.toUpperCase()}.`,
          type: "success",
        });
      } else {
        throw new Error(data.error || "Cleanup failed.");
      }
    } catch (err: any) {
      setModal({
        isOpen: true,
        title: "Cleanup Failed",
        description: err.message,
        type: "error",
      });
    } finally {
      setCleaningEnv(null);
    }
  };

  const handleRestartServer = async () => {
    setModal({
      isOpen: true,
      title: "Restart Server?",
      description:
        "Are you sure you want to restart the UI Server? This will terminate all active connections.",
      type: "confirm",
      onConfirm: async () => {
        setModal((prev) => ({ ...prev, isOpen: false }));
        setIsRestarting(true);
        try {
          const res = await fetch(getApiUrl("/api/restart"), {
            method: "POST",
          });
          if (res.ok) {
            setModal({
              isOpen: true,
              title: "Restarting",
              description:
                "Restarting... please wait 5-10 seconds and refresh the page.",
              type: "success",
            });
          } else {
            throw new Error("Failed to send restart command.");
          }
        } catch (err: any) {
          setModal({
            isOpen: true,
            title: "Restart Failed",
            description: err.message,
            type: "error",
          });
        } finally {
          setIsRestarting(false);
        }
      },
    });
  };

  const handleShutdownServer = async () => {
    setModal({
      isOpen: true,
      title: "Shutdown Server?",
      description:
        "Are you sure you want to SHUT DOWN the server? You will need manual server access to start it again.",
      type: "warning",
      confirmText: "Yes, Shutdown",
      onConfirm: async () => {
        setModal((prev) => ({ ...prev, isOpen: false }));
        setIsShuttingDown(true);
        try {
          const res = await fetch(getApiUrl("/api/shutdown"), {
            method: "POST",
          });
          if (res.ok) {
            setModal({
              isOpen: true,
              title: "Server Offline",
              description:
                "Server is shutting down. The UI will now be unresponsive.",
              type: "info",
            });
          } else {
            throw new Error("Failed to send shutdown command.");
          }
        } catch (err: any) {
          setModal({
            isOpen: true,
            title: "Shutdown Failed",
            description: err.message,
            type: "error",
          });
        } finally {
          setIsShuttingDown(false);
        }
      },
    });
  };

  const envOptions = ["dev", "qa", "preprod"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-3xl pb-20"
    >
      {/* SSH Keys Section */}
      <Section
        icon={Key}
        title="SSH Private Keys"
        description="Link your local .pem files to enable secure connectivity. Select an environment to set its path."
        saving={keySaving}
        saved={keySuccess}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {envs.map((env) => (
              <div
                key={env}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, env)}
                className={cn(
                  "flex flex-col gap-3 p-4 rounded-xl border transition-all",
                  editingEnv === env
                    ? "bg-primary/5 border-primary/20 shadow-lg ring-1 ring-primary/20"
                    : "bg-white/5 border-white/5 hover:border-white/10",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-1.5 rounded-lg",
                        linkedKeys[env]
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-zinc-500/10 text-zinc-500",
                      )}
                    >
                      {linkedKeys[env] ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        {env}
                      </p>
                      <p className="text-xs text-zinc-500 font-mono truncate max-w-[200px] md:max-w-md">
                        {linkedKeys[env] || "No local path linked"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingEnv(editingEnv === env ? null : env);
                        setKeyContent(linkedKeys[env] || "");
                      }}
                      className="h-8 text-[10px] bg-white/5"
                    >
                      {linkedKeys[env] ? "Update Path" : "Link Key"}
                    </Button>
                    {linkedKeys[env] && (
                      <button
                        onClick={() => handleRemoveKey(env)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {editingEnv === env && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-3 pt-3 border-t border-white/10"
                  >
                    <>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <FolderOpen className="w-3 h-3" /> Full Local Path to
                        .PEM
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            placeholder="e.g. /home/ubuntu/keys/dev.pem"
                            value={keyContent}
                            onChange={(e) => setKeyContent(e.target.value)}
                            className="bg-black/20 border-white/10 text-xs font-mono h-9 pr-24"
                            autoFocus
                          />
                          {systemInfo?.platform === "darwin" && (
                            <button
                              onClick={handleBrowse}
                              disabled={isBrowsing}
                              className="absolute right-1 top-1 bottom-1 px-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-bold text-zinc-400 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                              {isBrowsing ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <Search className="w-2.5 h-2.5" />
                              )}
                              Browse...
                            </button>
                          )}
                        </div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept=".pem"
                          onChange={handleFileSelect}
                        />
                        <Button
                          onClick={() => handleSaveKey(env, keyContent)}
                          disabled={keySaving || !keyContent.trim()}
                          size="sm"
                          className="h-9 px-4"
                        >
                          Apply
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setEditingEnv(null)}
                          size="sm"
                          className="h-9"
                        >
                          Cancel
                        </Button>
                      </div>

                      {systemInfo?.platform === "darwin" ? (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                          <div className="p-1 rounded bg-blue-500/10 text-blue-400">
                            <Info className="w-3 h-3" />
                          </div>
                          <p className="text-[9px] text-zinc-400 leading-tight">
                            <span className="font-bold text-blue-400">
                              Mac Tip:
                            </span>{" "}
                            Drag your .pem file from Finder directly into the
                            box above to get the{" "}
                            <span className="text-zinc-200">
                              Full Absolute Path
                            </span>{" "}
                            automatically!
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                          <div className="p-1 rounded bg-amber-500/10 text-amber-400">
                            <Shield className="w-3 h-3" />
                          </div>
                          <p className="text-[9px] text-zinc-400 leading-tight">
                            <span className="font-bold text-amber-400">
                              Cloud Tip:
                            </span>{" "}
                            For Render/Cloud, set an environment variable named{" "}
                            <code className="text-zinc-200">
                              SSH_KEY_{env.toUpperCase().replace(/-/g, "_")}
                            </code>{" "}
                            with your .pem file content. The app will
                            automatically bootstrap it on startup.
                          </p>
                        </div>
                      )}
                    </>
                    {keyError && (
                      <p className="text-[10px] text-red-400 font-medium">
                        {keyError}
                      </p>
                    )}
                  </motion.div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-white/5 space-y-4">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Manual Cleanup
            </h4>
            <div className="flex gap-4">
              {envs.map((env) => (
                <Button
                  key={env}
                  variant="outline"
                  size="sm"
                  onClick={() => handleCleanup(env)}
                  disabled={cleaningEnv === env}
                  className="flex-1 gap-2 border-white/5 hover:bg-white/5 text-zinc-400"
                >
                  <Trash2
                    className={cn(
                      "w-3.5 h-3.5",
                      cleaningEnv === env && "animate-spin",
                    )}
                  />
                  {cleaningEnv === env
                    ? "Cleaning..."
                    : `Cleanup ${env.toUpperCase()}`}
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 italic">
              * Automatic cleanup is disabled. Click above to remove backups
              older than the retention count set above.
            </p>
          </div>
        </div>
      </Section>

      {/* Deployment Defaults */}
      <Section
        icon={Sliders}
        title="Deployment Defaults"
        description="Pre-selected values shown when the Dashboard loads"
        onSave={handleSaveUI}
        saving={false}
        saved={uiSaved}
      >
        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Default Source">
            <select
              value={prefs.defaultSourceEnv}
              onChange={(e) => updatePref("defaultSourceEnv", e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {envOptions.map((e) => (
                <option key={e} value={e}>
                  {e.toUpperCase()}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Default Target">
            <select
              value={prefs.defaultTargetEnv}
              onChange={(e) => updatePref("defaultTargetEnv", e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {envOptions.map((e) => (
                <option key={e} value={e}>
                  {e.toUpperCase()}
                </option>
              ))}
            </select>
          </FieldRow>
        </div>
        <div className="space-y-3 pt-1">
          <ToggleRow
            label="Dry Run by default"
            description="Start every session with dry run mode enabled"
            value={prefs.dryRunDefault}
            onChange={(v) => updatePref("dryRunDefault", v)}
          />
          <ToggleRow
            label="Auto-select first game"
            description="Automatically select the first game in the list on load"
            value={prefs.autoSelectFirstGame}
            onChange={(v) => updatePref("autoSelectFirstGame", v)}
          />
          <ToggleRow
            label="Game backup enabled by default"
            value={prefs.gameBackupDefault}
            onChange={(v) => updatePref("gameBackupDefault", v)}
          />
          <ToggleRow
            label="JSON backup enabled by default"
            value={prefs.jsonBackupDefault}
            onChange={(v) => updatePref("jsonBackupDefault", v)}
          />
        </div>
      </Section>

      {/* Backup Settings */}
      <Section
        icon={Shield}
        title="Backup Retention"
        description="How many backup snapshots to keep per environment (persisted to deployment.config.json)"
        onSave={handleSaveServer}
        saving={serverSaving}
        saved={serverSaved}
      >
        {loadingServer ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(serverSettings.backupRetention).map(
              ([env, count]) => (
                <FieldRow
                  key={env}
                  label={`${env.toUpperCase()} Backups`}
                  description="Number of backups to keep"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={count}
                      onChange={(e) =>
                        setServerSettings((s) => ({
                          ...s,
                          backupRetention: {
                            ...s.backupRetention,
                            [env]: Number(e.target.value),
                          },
                        }))
                      }
                      className="flex-1 accent-primary"
                    />
                    <span className="text-sm font-bold font-mono w-6 text-center text-primary">
                      {count}
                    </span>
                  </div>
                </FieldRow>
              ),
            )}
          </div>
        )}
      </Section>

      {/* Connection Settings */}
      <Section
        icon={Server}
        title="Connection & Paths"
        description="Source path and SSH behaviour (persisted to deployment.config.json)"
        onSave={handleSaveServer}
        saving={serverSaving}
        saved={serverSaved}
      >
        {loadingServer ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          <>
            <FieldRow
              label="Source Path"
              description="Base path on the DEV server where game files live"
            >
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <Input
                  value={serverSettings.sourcePath}
                  onChange={(e) =>
                    setServerSettings((s) => ({
                      ...s,
                      sourcePath: e.target.value,
                    }))
                  }
                  className="pl-9 bg-zinc-900/50 border-white/10 font-mono text-xs"
                />
              </div>
            </FieldRow>
            <FieldRow
              label="SSH Health Check Timeout"
              description="Max seconds to wait per SSH ping in System Health"
            >
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={Math.round(prefs.sshTimeoutMs / 1000)}
                  onChange={(e) =>
                    updatePref("sshTimeoutMs", Number(e.target.value) * 1000)
                  }
                  className="flex-1 accent-primary"
                />
                <span className="text-sm font-bold font-mono w-8 text-center text-primary">
                  {Math.round(prefs.sshTimeoutMs / 1000)}s
                </span>
              </div>
            </FieldRow>
            <FieldRow
              label="Environment Health Check Interval"
              description="How often the header env pills re-poll (seconds)"
            >
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={120}
                  step={10}
                  value={prefs.healthCheckInterval}
                  onChange={(e) =>
                    updatePref("healthCheckInterval", Number(e.target.value))
                  }
                  className="flex-1 accent-primary"
                />
                <span className="text-sm font-bold font-mono w-8 text-center text-primary">
                  {prefs.healthCheckInterval}s
                </span>
              </div>
            </FieldRow>
          </>
        )}
      </Section>

      {/* UI Preferences */}
      <Section
        icon={Monitor}
        title="UI Preferences"
        description="Saved to browser localStorage — no server restart needed"
        onSave={handleSaveUI}
        saved={uiSaved}
      >
        <div className="space-y-3">
          <FieldRow label="Theme">
            <div className="flex gap-2">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => updatePref("theme", t)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                    prefs.theme === t
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/20",
                  )}
                >
                  {t === "dark" ? (
                    <Moon className="w-4 h-4" />
                  ) : (
                    <Sun className="w-4 h-4" />
                  )}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </FieldRow>
          <ToggleRow
            label="Auto-scroll logs"
            description="Automatically scroll to the latest log entry during deployment"
            value={prefs.logAutoScroll}
            onChange={(v) => updatePref("logAutoScroll", v)}
          />
        </div>
        <div className="flex justify-end pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetUI}
            className="gap-2 text-zinc-400"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset to Defaults
          </Button>
        </div>
      </Section>

      {/* System Actions */}
      <Section
        icon={Shield}
        title="System Actions"
        description="Critical server management and troubleshooting tools"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div>
                <p className="text-sm font-medium">API Configuration</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Reset the application to use default production endpoints.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.removeItem("custom_api_url");
                  window.location.reload();
                }}
                className="gap-2 border-white/10"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset API
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div>
                <p className="text-sm font-medium">Server Status</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Restart or shutdown the backend process.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestartServer}
                  disabled={isRestarting}
                  className="gap-2 border-white/10"
                >
                  <RefreshCw
                    className={cn(
                      "w-3.5 h-3.5",
                      isRestarting && "animate-spin",
                    )}
                  />
                  Restart
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShutdownServer}
                  disabled={isShuttingDown}
                  className="gap-2 border-red-500/20 text-red-400 hover:bg-red-500/10"
                >
                  <Power className="w-3.5 h-3.5" />
                  Shutdown
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* About & Export */}
      <Section
        icon={Info}
        title="About & Export"
        description="System information and configuration export"
      >
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "App Version", value: `v${__APP_VERSION__}` },
            { label: "Config File", value: "deployment.config.json" },
            {
              label: "Total Games",
              value: configJson
                ? String(
                    Object.keys(JSON.parse(configJson).gameFolderMap || {})
                      .length,
                  )
                : "…",
            },
            {
              label: "Environments",
              value: configJson
                ? String(
                    Object.keys(JSON.parse(configJson).servers || {}).length,
                  )
                : "…",
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="p-3 rounded-lg bg-white/5 border border-white/5"
            >
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                {label}
              </p>
              <p className="text-sm font-bold font-mono mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" /> Export Config
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyConfig}
            className="gap-2"
          >
            <Copy className="w-4 h-4" />
            {copied ? "Copied!" : "Copy JSON"}
          </Button>
        </div>
      </Section>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal((prev) => ({ ...prev, isOpen: false }))}
        title={modal.title}
        description={modal.description}
        type={modal.type}
        onConfirm={modal.onConfirm}
        confirmText={modal.confirmText}
      />
    </motion.div>
  );
}

// Export prefs loader for other components to use
export { loadPrefs };
export type { UIPrefs };
