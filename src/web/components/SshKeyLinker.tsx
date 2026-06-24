import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key,
  Lock,
  Search,
  Loader2,
  FolderOpen,
  Info,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { cn } from "../lib/utils";
import { browseSshKey, fetchSshKeys, getApiUrl, saveSshKey } from "../api";

export const SSH_KEYS_UPDATED_EVENT = "sshKeysUpdated";

function notifyKeysUpdated() {
  window.dispatchEvent(new CustomEvent(SSH_KEYS_UPDATED_EVENT));
}

interface SshKeyLinkerProps {
  envs: string[];
  onKeysUpdated?: () => void;
  /** When true, show a collapsible summary once all keys are linked (browse still available). */
  collapsible?: boolean;
  title?: string;
}

export function SshKeyLinker({
  envs,
  onKeysUpdated,
  collapsible = true,
  title = "Link Local SSH Keys",
}: SshKeyLinkerProps) {
  const uniqueEnvs = [...new Set(envs.filter(Boolean))];
  const [linkedKeys, setLinkedKeys] = useState<
    Record<string, { path: string; exists: boolean }>
  >({});
  const [editingEnv, setEditingEnv] = useState<string | null>(null);
  const [keyContent, setKeyContent] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [browsingEnv, setBrowsingEnv] = useState<string | null>(null);
  const [systemPlatform, setSystemPlatform] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const loadKeys = useCallback(async () => {
    try {
      const data = await fetchSshKeys();
      setLinkedKeys(data.keys || {});
    } catch {
      setLinkedKeys({});
    }
  }, []);

  useEffect(() => {
    void loadKeys();
    fetch(getApiUrl("/api/health"))
      .then((r) => r.json())
      .then((data) => setSystemPlatform(data.platform || null))
      .catch(() => {});
  }, [loadKeys]);

  const canBrowseNatively =
    systemPlatform === "darwin" ||
    (systemPlatform === null &&
      typeof navigator !== "undefined" &&
      /Mac/i.test(navigator.userAgent));

  const missingEnvs = uniqueEnvs.filter((env) => !linkedKeys[env]?.exists);
  const allLinked = missingEnvs.length === 0;

  useEffect(() => {
    setExpanded(!allLinked);
  }, [allLinked]);

  const afterKeyChange = useCallback(async () => {
    await loadKeys();
    onKeysUpdated?.();
    notifyKeysUpdated();
  }, [loadKeys, onKeysUpdated]);

  const handleBrowseAndLink = async (env: string) => {
    setBrowsingEnv(env);
    setKeyError("");
    setEditingEnv(env);
    try {
      const data = await browseSshKey();
      if (data.cancelled) return;
      if (!data.path) {
        throw new Error(data.error || "No file selected");
      }
      await saveSshKey(env, data.path);
      setEditingEnv(null);
      setKeyContent("");
      await afterKeyChange();
    } catch (e: any) {
      setKeyContent(linkedKeys[env]?.path || "");
      setKeyError(e.message || "Failed to link key from browse");
    } finally {
      setBrowsingEnv(null);
    }
  };

  const handleBrowseIntoField = async () => {
    setBrowsingEnv(editingEnv);
    setKeyError("");
    try {
      const data = await browseSshKey();
      if (data.cancelled) return;
      if (data.path) {
        setKeyContent(data.path);
      } else if (data.error) {
        setKeyError(data.error);
      }
    } catch (e: any) {
      setKeyError(e.message || "Failed to open file picker");
    } finally {
      setBrowsingEnv(null);
    }
  };

  const handleSaveKey = async (env: string) => {
    if (!keyContent.trim()) return;
    setKeySaving(true);
    setKeyError("");
    try {
      await saveSshKey(env, keyContent.trim());
      setEditingEnv(null);
      setKeyContent("");
      await afterKeyChange();
    } catch (e: any) {
      setKeyError(e.message || "Failed to link key");
    } finally {
      setKeySaving(false);
    }
  };

  const isCollapsed = collapsible && allLinked && !expanded;

  return (
    <div
      className={cn(
        "rounded-2xl border backdrop-blur-xl transition-colors",
        allLinked
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/20 bg-amber-500/5",
      )}
    >
      <button
        type="button"
        onClick={() => collapsible && allLinked && setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-start gap-3 p-4 text-left",
          collapsible && allLinked && "cursor-pointer hover:bg-white/[0.02]",
        )}
      >
        <div
          className={cn(
            "p-2 rounded-lg shrink-0",
            allLinked ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400",
          )}
        >
          <Key className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={cn(
                "text-sm font-bold",
                allLinked ? "text-emerald-200" : "text-amber-200",
              )}
            >
              {title}
            </h3>
            {collapsible && allLinked && (
              <span className="text-zinc-500 shrink-0">
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Browse a local .pem file anytime — before or after deploy. Keys stay on
            your machine, not in the project.
          </p>
          {isCollapsed && (
            <p className="text-[10px] text-emerald-400/80 mt-1 font-mono truncate">
              {uniqueEnvs.map((e) => e.toUpperCase()).join(", ")} linked — click to
              browse or update
            </p>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {uniqueEnvs.map((env) => {
                const linked = linkedKeys[env];
                const isMissing = !linked?.exists;
                const isBrowsingThis = browsingEnv === env;

                return (
                  <div
                    key={env}
                    className={cn(
                      "flex flex-col gap-3 p-4 rounded-xl border transition-all",
                      editingEnv === env
                        ? "bg-primary/5 border-primary/20"
                        : isMissing
                          ? "bg-amber-500/5 border-amber-500/20"
                          : "bg-white/5 border-white/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "p-1.5 rounded-lg shrink-0",
                            linked?.exists
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400",
                          )}
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                            {env}
                          </p>
                          <p className="text-xs text-zinc-500 font-mono truncate">
                            {linked?.exists
                              ? linked.path
                              : "No local .pem linked"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleBrowseAndLink(env)}
                          disabled={isBrowsingThis || keySaving}
                          className="h-8 text-[10px] bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                        >
                          {isBrowsingThis ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Search className="w-3 h-3" />
                          )}
                          <span className="ml-1.5">Browse local</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingEnv(editingEnv === env ? null : env);
                            setKeyContent(linked?.path || "");
                            setKeyError("");
                          }}
                          className="h-8 text-[10px] bg-white/5"
                        >
                          Edit path
                        </Button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {editingEnv === env && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-3 pt-3 border-t border-white/10 overflow-hidden"
                        >
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <FolderOpen className="w-3 h-3" /> Full local path to
                            .pem
                          </label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Input
                                placeholder="e.g. /Users/you/keys/dev.pem"
                                value={keyContent}
                                onChange={(e) => setKeyContent(e.target.value)}
                                className="bg-black/20 border-white/10 text-xs font-mono h-9 pr-24"
                                autoFocus
                              />
                              {canBrowseNatively && (
                                <button
                                  type="button"
                                  onClick={() => void handleBrowseIntoField()}
                                  disabled={Boolean(browsingEnv)}
                                  className="absolute right-1 top-1 bottom-1 px-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-bold text-zinc-400 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                  {browsingEnv ? (
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  ) : (
                                    <Search className="w-2.5 h-2.5" />
                                  )}
                                  Browse...
                                </button>
                              )}
                            </div>
                            <Button
                              onClick={() => void handleSaveKey(env)}
                              disabled={keySaving || !keyContent.trim()}
                              size="sm"
                              className="h-9 px-4"
                            >
                              Apply
                            </Button>
                          </div>

                          {canBrowseNatively ? (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                              <Info className="w-3 h-3 text-blue-400 shrink-0" />
                              <p className="text-[9px] text-zinc-400">
                                Use <strong className="text-blue-400">Browse local</strong>{" "}
                                for one-click linking, or pick a file here then Apply.
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                              <Shield className="w-3 h-3 text-amber-400 shrink-0" />
                              <p className="text-[9px] text-zinc-400">
                                Enter the full path to your local .pem file, or set{" "}
                                <code className="text-zinc-200">
                                  SSH_KEY_{env.toUpperCase()}
                                </code>{" "}
                                for cloud hosts.
                              </p>
                            </div>
                          )}

                          {keyError && (
                            <p className="text-[10px] text-red-400 font-medium">
                              {keyError}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function useSshKeysReady(envs: string[]): {
  ready: boolean;
  loading: boolean;
  refresh: () => void;
} {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchSshKeys()
      .then((data) => {
        const keys = data.keys || {};
        const allReady = envs.every((env) => keys[env]?.exists);
        setReady(allReady);
      })
      .catch(() => setReady(false))
      .finally(() => setLoading(false));
  }, [envs]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener(SSH_KEYS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(SSH_KEYS_UPDATED_EVENT, handler);
  }, [refresh]);

  return { ready, loading, refresh };
}
