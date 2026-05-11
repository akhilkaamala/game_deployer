import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Key,
  AlertTriangle,
  Globe,
  HardDrive,
  FolderOpen,
  CloudLightning,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { cn } from "../lib/utils";
import { getApiUrl } from "../api";

interface ServerConfig {
  user: string;
  host: string;
  port: number | null;
  key: string;
  basePath: string;
  jsonRootPath: string;
  cloudfrontDistribution: string | null;
  backupRoot: string;
}

interface EnvMap {
  [name: string]: ServerConfig;
}

const FIELD_META: {
  key: keyof ServerConfig;
  label: string;
  icon: React.ElementType;
  placeholder: string;
  type?: string;
}[] = [
  {
    key: "user",
    label: "SSH User",
    icon: Key,
    placeholder: "e.g. blazeagrdev",
  },
  {
    key: "host",
    label: "Host / IP",
    icon: Globe,
    placeholder: "e.g. 3.1.242.159",
  },
  {
    key: "port",
    label: "Port (null for 22)",
    icon: HardDrive,
    placeholder: "e.g. 22 or leave blank",
    type: "number",
  },
  {
    key: "key",
    label: "Key Path",
    icon: Key,
    placeholder: "e.g. ./keys/blazeagrdev.pem",
  },
  {
    key: "basePath",
    label: "Base Path",
    icon: FolderOpen,
    placeholder: "e.g. /home/user/games",
  },
  {
    key: "jsonRootPath",
    label: "JSON Root Path",
    icon: FolderOpen,
    placeholder: "e.g. /home/user/games/content/locale",
  },
  {
    key: "cloudfrontDistribution",
    label: "CloudFront ID (optional)",
    icon: CloudLightning,
    placeholder: "e.g. E2XV2YWOZQAK35",
  },
  {
    key: "backupRoot",
    label: "Backup Root",
    icon: HardDrive,
    placeholder: "e.g. /home/user/deployment_backups",
  },
];

const ENV_COLORS: Record<string, string> = {
  dev: "from-blue-500/20 to-blue-600/5 border-blue-500/20",
  qa: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20",
  preprod: "from-amber-500/20 to-amber-600/5 border-amber-500/20",
};

const ENV_BADGE: Record<string, string> = {
  dev: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  qa: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  preprod: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

function getEnvColor(name: string) {
  const lower = name.toLowerCase();
  for (const key of Object.keys(ENV_COLORS)) {
    if (lower.includes(key)) return ENV_COLORS[key];
  }
  return "from-purple-500/20 to-purple-600/5 border-purple-500/20";
}

function getEnvBadge(name: string) {
  const lower = name.toLowerCase();
  for (const key of Object.keys(ENV_BADGE)) {
    if (lower.includes(key)) return ENV_BADGE[key];
  }
  return "bg-purple-500/10 text-purple-400 border-purple-500/20";
}

const emptyServer: ServerConfig = {
  user: "",
  host: "",
  port: null,
  key: "",
  basePath: "",
  jsonRootPath: "",
  cloudfrontDistribution: null,
  backupRoot: "",
};

export function EnvironmentsManager() {
  const [envs, setEnvs] = useState<EnvMap>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{
    mode: "create" | "edit";
    name: string;
    data: ServerConfig;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedEnvs, setRevealedEnvs] = useState<Set<string>>(new Set());

  const fetchEnvs = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/environments"));
      const data = await res.json();
      setEnvs(data);
    } catch {
      setError("Failed to load environments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvs();
  }, [fetchEnvs]);

  const openCreate = () =>
    setModal({ mode: "create", name: "", data: { ...emptyServer } });

  const toggleReveal = (name: string) => {
    setRevealedEnvs((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const openEdit = (name: string) =>
    setModal({ mode: "edit", name, data: { ...envs[name] } });

  const handleSave = async () => {
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const { mode, name, data } = modal;
      const payload = mode === "create" ? { name, ...data } : data;
      const res = await fetch(
        getApiUrl(
          mode === "create" ? "/api/environments" : `/api/environments/${name}`,
        ),
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      await fetchEnvs();
      setModal(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(getApiUrl(`/api/environments/${deleteTarget}`), {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      await fetchEnvs();
      setDeleteTarget(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof ServerConfig, value: string) => {
    if (!modal) return;
    setModal((prev) =>
      prev
        ? {
            ...prev,
            data: {
              ...prev.data,
              [key]:
                key === "port"
                  ? value === ""
                    ? null
                    : Number(value)
                  : value === "" && key === "cloudfrontDistribution"
                    ? null
                    : value,
            },
          }
        : null,
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        <Server className="w-6 h-6 animate-pulse mr-2" /> Loading
        environments...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Environments</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Manage server configurations for DEV, QA, and PreProd
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Environment
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Environment Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6 items-stretch">
        <AnimatePresence>
          {Object.entries(envs).map(([name, config], i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.05 }}
              className="h-full"
            >
              <Card
                className={cn(
                  "relative overflow-hidden border bg-gradient-to-br h-full",
                  getEnvColor(name),
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                        <Server className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold uppercase tracking-widest">
                          {name}
                        </CardTitle>
                        <span
                          className={cn(
                            "text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest",
                            getEnvBadge(name),
                          )}
                        >
                          {revealedEnvs.has(name)
                            ? config.host
                            : "***.***.***.***"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleReveal(name)}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        title={
                          revealedEnvs.has(name)
                            ? "Hide Details"
                            : "Show Details"
                        }
                      >
                        {revealedEnvs.has(name) ? (
                          <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                      </button>
                      <button
                        onClick={() => openEdit(name)}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(name)}
                        className="p-1.5 rounded-lg bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "User", value: config.user },
                    { label: "Port", value: config.port ?? "22 (default)" },
                    { label: "Key", value: config.key },
                    { label: "Base Path", value: config.basePath },
                    { label: "JSON Root", value: config.jsonRootPath },
                    { label: "Backup Root", value: config.backupRoot },
                    ...(config.cloudfrontDistribution
                      ? [
                          {
                            label: "CloudFront",
                            value: config.cloudfrontDistribution,
                          },
                        ]
                      : []),
                  ].map(({ label, value }) => {
                    const isRevealed = revealedEnvs.has(name);
                    const displayValue = isRevealed
                      ? String(value)
                      : "********";
                    return (
                      <div key={label} className="flex gap-2 text-xs">
                        <span className="text-zinc-500 w-24 flex-shrink-0 font-medium">
                          {label}
                        </span>
                        <span
                          className={cn(
                            "font-mono break-all",
                            isRevealed
                              ? "text-zinc-300"
                              : "text-zinc-600 tracking-wider",
                          )}
                        >
                          {displayValue}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Server className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-base font-bold uppercase tracking-wider">
                    {modal.mode === "create"
                      ? "New Environment"
                      : `Edit — ${modal.name}`}
                  </h3>
                </div>
                <button
                  onClick={() => setModal(null)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {modal.mode === "create" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      Environment Name
                    </label>
                    <Input
                      placeholder="e.g. dev, qa, preprod, staging"
                      value={modal.name}
                      onChange={(e) =>
                        setModal((p) =>
                          p
                            ? {
                                ...p,
                                name: e.target.value
                                  .toLowerCase()
                                  .replace(/\s+/g, ""),
                              }
                            : null,
                        )
                      }
                      className="bg-zinc-900/50 border-white/10"
                    />
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" /> {error}
                  </div>
                )}

                {FIELD_META.map(
                  ({ key, label, icon: Icon, placeholder, type }) => (
                    <div key={key} className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Icon className="w-3 h-3" /> {label}
                      </label>
                      <Input
                        type={type || "text"}
                        placeholder={placeholder}
                        value={
                          modal.data[key] === null
                            ? ""
                            : String(modal.data[key])
                        }
                        onChange={(e) => updateField(key, e.target.value)}
                        className="bg-zinc-900/50 border-white/10 font-mono text-xs"
                      />
                    </div>
                  ),
                )}
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                <Button variant="outline" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving
                    ? "Saving..."
                    : modal.mode === "create"
                      ? "Create Environment"
                      : "Save Changes"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-zinc-950 border border-red-500/20 rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </div>
                <h3 className="text-base font-bold">Delete Environment</h3>
              </div>
              <p className="text-sm text-zinc-400">
                Are you sure you want to delete{" "}
                <span className="text-white font-bold uppercase">
                  {deleteTarget}
                </span>
                ? This will remove it from{" "}
                <code className="text-xs bg-white/5 px-1 rounded">
                  deployment.config.json
                </code>
                .
              </p>
              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={saving}
                  className="bg-red-600 hover:bg-red-700 text-white gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {saving ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
