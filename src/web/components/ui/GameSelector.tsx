import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  Layers,
  Database,
  Archive,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Input } from "./Input";
import { ScrollArea } from "./ScrollArea";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { GameGrid, GameCard } from "./GameGrid";
import { cn } from "../../lib/utils";

interface GameSelectorProps {
  games: string[];
  selectedGames: string[];
  backupGames: string[];
  gameFolderMap: Record<string, any>;
  gameSizes?: Record<string, number>;
  gameUpdates?: Record<string, number>;
  loadingSizes?: boolean;
  onToggle: (game: string) => void;
  onToggleBackup: (game: string) => void;
  onSelectAll: (games: string[]) => void;
  onDeselectAll: () => void;
  onSelectBackups: (games: string[]) => void;
  onDeselectBackups: () => void;
  hideBackup?: boolean;
}

export function GameSelector({
  games,
  selectedGames,
  backupGames,
  gameFolderMap,
  gameSizes = {},
  gameUpdates = {},
  loadingSizes = false,
  onToggle,
  onToggleBackup,
  onSelectAll,
  onDeselectAll,
  onSelectBackups,
  onDeselectBackups,
  hideBackup = false,
}: GameSelectorProps) {
  const [search, setSearch] = useState("");
  const [showActions, setShowActions] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Derive category from jsonExt — stays in sync with deployment.config.json
  function getCategoryFromJsonExt(jsonExt: string): string {
    const lower = (jsonExt || "").toLowerCase();
    if (lower.includes("/slot/nordic")) return "SLOT - Nordic";
    if (lower.includes("/slot/pharaoh")) return "SLOT - Pharaoh";
    if (lower.includes("/slot/farm")) return "SLOT - Farm";
    if (lower.includes("/slot/china")) return "SLOT - China";
    if (lower.includes("/slot/greek")) return "SLOT - Greek";
    if (lower.includes("/slot/buffalo")) return "SLOT - Buffalo";
    if (lower.includes("/draw")) return "DRAW";
    if (lower.includes("/table")) return "TABLE";
    if (lower.includes("/roulette")) return "ROULETTE";
    if (lower.includes("/trading")) return "TRADING";
    if (lower.includes("/cocos")) return "INSTANT GAMES";
    return "Other";
  }

  const groupedGames = useMemo(() => {
    const groups: Record<string, string[]> = {};

    games.forEach((game) => {
      const entry = gameFolderMap[game];
      const category = entry?.jsonExt
        ? getCategoryFromJsonExt(entry.jsonExt)
        : "Other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(game);
    });

    return groups;
  }, [games, gameFolderMap]);

  const filteredGroups = useMemo(() => {
    const result: Record<string, string[]> = {};
    Object.entries(groupedGames).forEach(([category, groupGames]) => {
      const filtered = groupGames.filter((game) =>
        (game?.toLowerCase() || "").includes((search || "").toLowerCase()),
      );
      if (filtered.length > 0) result[category] = filtered;
    });
    return result;
  }, [groupedGames, search]);

  const allFilteredGames = useMemo(
    () => Object.values(filteredGroups).flat(),
    [filteredGroups],
  );

  const allSelected =
    allFilteredGames.length > 0 &&
    allFilteredGames.every((g) => selectedGames.includes(g));

  const handleSelectAll = () => {
    if (allSelected) {
      onDeselectAll();
    } else {
      onSelectAll(allFilteredGames);
    }
  };

  const visibleCategories = Object.keys(filteredGroups);
  const allVisibleExpanded =
    visibleCategories.length > 0 &&
    visibleCategories.every((c) => expandedGroups.includes(c));

  const toggleAllGroups = () => {
    if (allVisibleExpanded) setExpandedGroups([]);
    else setExpandedGroups(visibleCategories);
  };

  const toggleGroup = (category: string) => {
    setExpandedGroups((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  React.useEffect(() => {
    if (search) {
      setExpandedGroups(Object.keys(filteredGroups));
    }
  }, [search, filteredGroups]);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 group/search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 transition-colors group-focus-within/search:text-primary" />
            <Input
              placeholder="Search games..."
              className="h-10 pl-9 bg-white/[0.02] border-white/5 focus:border-primary/50 focus:ring-0 transition-all text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowActions(!showActions)}
            className={cn(
              "p-2.5 rounded-lg border transition-all",
              showActions
                ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]"
                : "bg-white/[0.02] border-white/5 text-zinc-600 hover:bg-white/10 hover:border-white/10",
            )}
            title="Toggle Group Actions Visibility"
          >
            <Layers className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 rounded-lg p-1">
            <button
              onClick={toggleAllGroups}
              className="p-1.5 rounded-md hover:bg-white/5 text-zinc-600 hover:text-white transition-all"
              title={allVisibleExpanded ? "Collapse" : "Expand"}
            >
              {allVisibleExpanded ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-3 py-2">
          {Object.entries(filteredGroups).map(([category, groupGames]) => {
            const isExpanded = expandedGroups.includes(category);
            const groupSelectedCount = groupGames.filter((g) =>
              selectedGames.includes(g),
            ).length;
            const [mainCategory, subCategory] = category.split(" - ");
            const allInGroupSelected = groupGames.every((g) =>
              selectedGames.includes(g),
            );
            const selectedInGroup = groupGames.filter((g) =>
              selectedGames.includes(g),
            );
            const allInGroupBackedUp =
              selectedInGroup.length > 0 &&
              selectedInGroup.every((g) => backupGames.includes(g));

            return (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors group/header">
                  <div
                    className="flex items-center gap-2 cursor-pointer flex-1"
                    onClick={() => toggleGroup(category)}
                  >
                    <ChevronDown
                      className={cn(
                        "w-3.5 h-3.5 text-zinc-600 transition-transform duration-300",
                        !isExpanded && "-rotate-90",
                      )}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-primary/70">
                        {mainCategory}
                      </span>
                      {subCategory && (
                        <>
                          <span className="text-zinc-800 text-[10px]">/</span>
                          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400">
                            {subCategory}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="w-5 h-5 flex items-center justify-center bg-white/10 rounded-full border border-white/5 shadow-inner">
                      <span className="text-[10px] font-mono font-black text-zinc-300">
                        {groupGames.length}
                      </span>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-1 transition-all duration-300",
                      showActions
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 translate-x-4 pointer-events-none group-hover/header:opacity-100 group-hover/header:translate-x-0 group-hover/header:pointer-events-auto",
                    )}
                  >
                    <button
                      className={cn(
                        "text-[9px] font-black uppercase tracking-tight transition-colors px-1",
                        allInGroupSelected
                          ? "text-primary"
                          : "text-zinc-500 hover:text-primary",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (allInGroupSelected) {
                          const newSelected = selectedGames.filter(
                            (g) => !groupGames.includes(g),
                          );
                          onSelectAll(newSelected);
                        } else {
                          const newSelected = [
                            ...new Set([...selectedGames, ...groupGames]),
                          ];
                          onSelectAll(newSelected);
                        }
                      }}
                    >
                      ALL
                    </button>
                    {!hideBackup && (
                      <>
                        <div className="w-px h-2 bg-white/10" />
                        <button
                          className={cn(
                            "text-[9px] font-black uppercase tracking-tight transition-colors px-1",
                            selectedInGroup.length === 0
                              ? "opacity-30 cursor-not-allowed pointer-events-none grayscale"
                              : allInGroupBackedUp
                                ? "text-emerald-500"
                                : "text-zinc-500 hover:text-emerald-500",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedInGroup.length === 0) return;

                            if (allInGroupBackedUp) {
                              const newBackups = backupGames.filter(
                                (g) => !selectedInGroup.includes(g),
                              );
                              onSelectBackups(newBackups);
                            } else {
                              const newBackups = [
                                ...new Set([...backupGames, ...selectedInGroup]),
                              ];
                              onSelectBackups(newBackups);
                            }
                          }}
                        >
                          BACKUP
                        </button>
                      </>
                    )}
                    {groupSelectedCount > 0 && (
                      <div className="w-4 h-4 flex items-center justify-center bg-primary rounded-full ml-1 shadow-[0_0_10px_rgba(var(--primary-rgb),0.3)]">
                        <span className="text-[9px] font-black text-primary-foreground">
                          {groupSelectedCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="py-1">
                    <GameGrid
                      games={groupGames}
                      selectedGames={selectedGames}
                      backupGames={backupGames}
                      gameFolderMap={gameFolderMap}
                      gameSizes={gameSizes}
                      gameUpdates={gameUpdates}
                      loadingSizes={loadingSizes}
                      onToggle={onToggle}
                      onToggleBackup={onToggleBackup}
                      hideBackup={hideBackup}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {Object.keys(filteredGroups).length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
            <Filter className="w-12 h-12 mb-4 opacity-20" />
            <p>No games found matching your search</p>
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center justify-between text-[10px] text-zinc-600 pt-2 border-t border-white/10 font-mono uppercase tracking-tight">
        <div className="flex gap-4">
          <span>Catalog: {games.length}</span>
          <span>Filtered: {allFilteredGames.length}</span>
          {!hideBackup && (
            <span className="text-primary/70">Backups: {backupGames.length}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Layers className="w-3 h-3" />
          <span className="font-bold text-primary">
            Selected: {selectedGames.length}
          </span>
        </div>
      </div>
    </div>
  );
}
