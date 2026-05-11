import React, { useState, useMemo } from "react";
import {
  Search,
  ChevronRight,
  Filter,
  ChevronDown,
  Layers,
} from "lucide-react";
import { Input } from "./Input";
import { ScrollArea } from "./ScrollArea";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { cn } from "../../lib/utils";

interface GameSelectorProps {
  games: string[];
  selectedGames: string[];
  gameFolderMap: Record<string, any>;
  onToggle: (game: string) => void;
  onSelectAll: (games: string[]) => void;
  onDeselectAll: () => void;
}

export function GameSelector({
  games,
  selectedGames,
  gameFolderMap,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: GameSelectorProps) {
  const [search, setSearch] = useState("");
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
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search games..."
            className="pl-9 bg-white/5 border-white/10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-10 border-white/10 bg-white/5 whitespace-nowrap"
          onClick={handleSelectAll}
        >
          {allSelected ? "Deselect All" : "Select Result"}
        </Button>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-4 py-2">
          {Object.entries(filteredGroups).map(([category, groupGames]) => {
            const isExpanded = expandedGroups.includes(category);
            const groupSelectedCount = groupGames.filter((g) =>
              selectedGames.includes(g),
            ).length;
            const [mainCategory, subCategory] = category.split(" - ");

            return (
              <div key={category} className="space-y-2">
                <button
                  onClick={() => toggleGroup(category)}
                  className="flex items-center justify-between w-full p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-zinc-500 transition-transform",
                        !isExpanded && "-rotate-90",
                      )}
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">
                        {mainCategory}
                      </span>
                      {subCategory && (
                        <>
                          <span className="text-zinc-700">/</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                            {subCategory}
                          </span>
                        </>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="h-4 text-[10px] bg-white/5 font-mono"
                    >
                      {groupGames.length}
                    </Badge>
                  </div>
                  {groupSelectedCount > 0 && (
                    <Badge
                      variant="success"
                      className="h-4 text-[9px] px-1.5 font-bold"
                    >
                      {groupSelectedCount} SELECTED
                    </Badge>
                  )}
                </button>

                {isExpanded && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pl-4 border-l border-white/5 ml-2">
                    {groupGames.map((game) => {
                      const isSelected = selectedGames.includes(game);
                      return (
                        <div
                          key={game}
                          onClick={() => onToggle(game)}
                          className={cn(
                            "group flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200",
                            isSelected
                              ? "bg-primary/10 border-primary/30 shadow-sm"
                              : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10",
                          )}
                        >
                          <div
                            className={cn(
                              "flex-shrink-0 w-4 h-4 rounded border transition-colors flex items-center justify-center",
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-zinc-500",
                            )}
                          >
                            {isSelected && <ChevronRight className="w-3 h-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-xs font-medium truncate",
                                isSelected ? "text-primary" : "text-zinc-400",
                              )}
                            >
                              {game}
                            </p>
                          </div>
                        </div>
                      );
                    })}
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
