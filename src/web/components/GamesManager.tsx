import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gamepad2,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  AlertTriangle,
  FolderOpen,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { cn } from "../lib/utils";
import { getApiUrl } from "../api";

interface GameEntry {
  path: string;
  jsonExt: string;
}

interface GameMap {
  [displayName: string]: GameEntry;
}

// Derive category from jsonExt prefix
function getCategory(jsonExt: string): string {
  const lower = jsonExt.toLowerCase();
  if (lower.includes("/slot/nordic")) return "Nordic";
  if (lower.includes("/slot/pharaoh")) return "Pharaoh";
  if (lower.includes("/slot/farm")) return "Farm";
  if (lower.includes("/slot/china")) return "China";
  if (lower.includes("/slot/greek")) return "Greek";
  if (lower.includes("/slot/buffalo")) return "Buffalo";
  if (lower.includes("/draw")) return "Draw";
  if (lower.includes("/table")) return "Table";
  if (lower.includes("/roulette")) return "Roulette";
  if (lower.includes("/trading")) return "Trading";
  if (lower.includes("/cocos")) return "Cocos";
  return "Other";
}

const CATEGORY_STYLES: Record<string, { card: string; badge: string; icon: string }> = {
  Nordic:   { card: "border-blue-500/20 bg-blue-500/5",    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",    icon: "text-blue-400" },
  Pharaoh:  { card: "border-amber-500/20 bg-amber-500/5",  badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",  icon: "text-amber-400" },
  Farm:     { card: "border-lime-500/20 bg-lime-500/5",    badge: "bg-lime-500/10 text-lime-400 border-lime-500/20",    icon: "text-lime-400" },
  China:    { card: "border-red-500/20 bg-red-500/5",      badge: "bg-red-500/10 text-red-400 border-red-500/20",      icon: "text-red-400" },
  Greek:    { card: "border-cyan-500/20 bg-cyan-500/5",    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",    icon: "text-cyan-400" },
  Buffalo:  { card: "border-orange-500/20 bg-orange-500/5",badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",icon: "text-orange-400" },
  Draw:     { card: "border-violet-500/20 bg-violet-500/5",badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",icon: "text-violet-400" },
  Table:    { card: "border-pink-500/20 bg-pink-500/5",    badge: "bg-pink-500/10 text-pink-400 border-pink-500/20",    icon: "text-pink-400" },
  Roulette: { card: "border-rose-500/20 bg-rose-500/5",    badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",    icon: "text-rose-400" },
  Trading:  { card: "border-teal-500/20 bg-teal-500/5",   badge: "bg-teal-500/10 text-teal-400 border-teal-500/20",   icon: "text-teal-400" },
  Cocos:    { card: "border-emerald-500/20 bg-emerald-500/5",badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",icon: "text-emerald-400" },
  Other:    { card: "border-zinc-500/20 bg-zinc-500/5",    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",    icon: "text-zinc-400" },
};

const CATEGORIES = ["Nordic", "Pharaoh", "Farm", "China", "Greek", "Buffalo", "Draw", "Table", "Roulette", "Trading", "Cocos"];

const CATEGORY_JSON_PREFIX: Record<string, string> = {
  Nordic: "/slot/nordic", Pharaoh: "/slot/pharaoh", Farm: "/slot/farm",
  China: "/slot/china", Greek: "/slot/greek", Buffalo: "/slot/buffalo",
  Draw: "/draw", Table: "/table", Roulette: "/roulette",
  Trading: "/trading", Cocos: "/cocos",
};

const emptyGame: { name: string; path: string; jsonExt: string; category: string } = {
  name: "", path: "", jsonExt: "", category: "Nordic",
};

export function GamesManager() {
  const [games, setGames] = useState<GameMap>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{
    mode: "create" | "edit";
    originalName: string;
    form: { name: string; path: string; jsonExt: string; category: string };
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/games"));
      const data = await res.json();
      setGames(data);
    } catch {
      setError("Failed to load games");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const openCreate = () => setModal({ mode: "create", originalName: "", form: { ...emptyGame } });

  const openEdit = (name: string, entry: GameEntry) => {
    const category = getCategory(entry.jsonExt);
    setModal({ mode: "edit", originalName: name, form: { name, path: entry.path, jsonExt: entry.jsonExt, category } });
  };

  const updateForm = (key: string, value: string) => {
    setModal((prev) => {
      if (!prev) return null;
      const form = { ...prev.form, [key]: value };
      // Auto-update jsonExt when category changes (if not manually set)
      if (key === "category" && CATEGORY_JSON_PREFIX[value]) {
        const prefix = CATEGORY_JSON_PREFIX[value];
        const currentFolder = form.path || form.name.toLowerCase().replace(/\s+/g, "_");
        form.jsonExt = prefix;
      }
      return { ...prev, form };
    });
  };

  const handleSave = async () => {
    if (!modal) return;
    setSaving(true);
    setError(null);
    try {
      const { mode, originalName, form } = modal;
      const payload = mode === "create"
        ? { name: form.name, path: form.path, jsonExt: form.jsonExt }
        : { newName: form.name, path: form.path, jsonExt: form.jsonExt };

      const res = await fetch(
        getApiUrl(mode === "create" ? "/api/games" : `/api/games/${encodeURIComponent(originalName)}`),
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      await fetchGames();
      window.dispatchEvent(new CustomEvent("gamesConfigUpdated"));
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
      const res = await fetch(getApiUrl(`/api/games/${encodeURIComponent(deleteTarget)}`), { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await fetchGames();
      window.dispatchEvent(new CustomEvent("gamesConfigUpdated"));
      setDeleteTarget(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Group games by category
  const grouped: Record<string, { name: string; entry: GameEntry }[]> = {};
  const searchLower = search.toLowerCase();
  Object.entries(games).forEach(([name, entry]) => {
    if (search && !name.toLowerCase().includes(searchLower) && !entry.path.toLowerCase().includes(searchLower)) return;
    const cat = getCategory(entry.jsonExt);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ name, entry });
  });

  const orderedCategories = CATEGORIES.filter((c) => grouped[c]);
  const otherGames = grouped["Other"] || [];

  const totalCount = Object.keys(games).length;
  const filteredCount = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        <Gamepad2 className="w-6 h-6 animate-pulse mr-2" /> Loading games…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Games Catalog</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {search ? `${filteredCount} of ${totalCount}` : totalCount} games across {orderedCategories.length} categories
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Add Game
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          placeholder="Search games…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card/50 border-border"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Grouped Categories */}
      <div className="space-y-4">
        {[...orderedCategories, ...(otherGames.length ? ["Other"] : [])].map((cat) => {
          const catGames = grouped[cat] || [];
          const style = CATEGORY_STYLES[cat] || CATEGORY_STYLES["Other"];
          const isCollapsed = collapsedCategories.has(cat);

          return (
            <motion.div key={cat} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center gap-3 mb-3 group"
              >
                <div className={cn("p-1 rounded", style.icon)}>
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
                <span className={cn("text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full border", style.badge)}>
                  {cat}
                </span>
                <span className="text-xs text-zinc-600">{catGames.length} game{catGames.length !== 1 ? "s" : ""}</span>
                <div className="flex-1 h-px bg-white/5" />
              </button>

              {/* Game Cards Grid */}
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3"
                  >
                    {catGames.map(({ name, entry }, i) => (
                      <motion.div
                        key={name}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <Card className={cn("border h-full", style.card)}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-semibold leading-snug text-white line-clamp-2">{name}</p>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => openEdit(name, entry)}
                                  className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(name)}
                                  className="p-1 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                <FolderOpen className="w-3 h-3 flex-shrink-0" />
                                <span className="font-mono truncate">{entry.path}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                <span className="text-zinc-600 font-mono">ext</span>
                                <span className="font-mono truncate">{entry.jsonExt}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
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
              className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Gamepad2 className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="text-base font-bold">
                    {modal.mode === "create" ? "Add Game" : `Edit — ${modal.originalName}`}
                  </h3>
                </div>
                <button onClick={() => setModal(null)} className="text-zinc-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" /> {error}
                  </div>
                )}

                {/* Display Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Display Name</label>
                  <Input
                    placeholder="e.g. Doodle Disco Wonderland"
                    value={modal.form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    className="bg-zinc-900/50 border-white/10"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Category</label>
                  <select
                    value={modal.form.category}
                    onChange={(e) => updateForm("category", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900/50 border border-white/10 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Folder Path */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Folder Path</label>
                  <Input
                    placeholder="e.g. doodle_disco_wonderland"
                    value={modal.form.path}
                    onChange={(e) => updateForm("path", e.target.value)}
                    className="bg-zinc-900/50 border-white/10 font-mono text-xs"
                  />
                </div>

                {/* JSON Ext */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">JSON Ext Path</label>
                  <Input
                    placeholder="e.g. /slot/nordic"
                    value={modal.form.jsonExt}
                    onChange={(e) => updateForm("jsonExt", e.target.value)}
                    className="bg-zinc-900/50 border-white/10 font-mono text-xs"
                  />
                  <p className="text-[10px] text-zinc-600">Auto-filled from category. Edit manually if needed.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-5 border-t border-white/10">
                <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? "Saving…" : modal.mode === "create" ? "Add Game" : "Save Changes"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
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
                <h3 className="text-base font-bold">Remove Game</h3>
              </div>
              <p className="text-sm text-zinc-400">
                Remove <span className="text-white font-bold">{deleteTarget}</span> from the game catalog? This only updates <code className="text-xs bg-white/5 px-1 rounded">deployment.config.json</code>.
              </p>
              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <Button onClick={handleDelete} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white gap-2">
                  <Trash2 className="w-4 h-4" />
                  {saving ? "Removing…" : "Remove"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
