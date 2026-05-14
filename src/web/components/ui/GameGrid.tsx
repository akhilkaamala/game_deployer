import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Database } from "lucide-react";
import { cn } from "../../lib/utils";

interface GameCardProps {
  game: string;
  gamePath?: string;
  imageUrl?: string;
  isSelected: boolean;
  isBackupEnabled: boolean;
  onToggle: (game: string) => void;
  onToggleBackup: (game: string) => void;
  isSpecial?: boolean;
  folderSize?: number;
  isLoadingSizes?: boolean;
}

function formatBytes(bytes: number, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const GameCard = React.memo(
  ({
    game,
    gamePath,
    imageUrl: explicitImageUrl,
    isSelected,
    isBackupEnabled,
    onToggle,
    onToggleBackup,
    isSpecial = false,
    folderSize,
    isLoadingSizes = false,
  }: GameCardProps) => {
    const [imgError, setImgError] = React.useState(false);
    const imageUrl = explicitImageUrl;

    return (
      <motion.div
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          "group relative flex flex-col gap-1.5 p-1.5 rounded-lg border cursor-pointer transition-all duration-300 select-none h-full",
          isSelected
            ? isSpecial
              ? "bg-amber-500/10 border-amber-500/40 shadow-md shadow-amber-500/5"
              : "bg-primary/10 border-primary/40 shadow-md shadow-primary/5"
            : "bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.03]",
        )}
        onClick={(e) => {
          // Prevent toggle if clicking the backup button specifically
          onToggle(game);
        }}
      >
        <div
          className={cn(
            "w-full aspect-square rounded-md overflow-hidden relative transition-all duration-500 bg-zinc-900/50",
            isSelected
              ? isSpecial
                ? "ring-1 ring-amber-500/30"
                : "ring-1 ring-primary/30"
              : "",
          )}
        >
          {/* Thumbnail Image / Placeholder */}
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-all duration-700",
              isSelected
                ? isSpecial
                  ? "bg-amber-500/10"
                  : "bg-primary/10"
                : "bg-white/[0.02]",
            )}
          >
            {imageUrl && !imgError ? (
              <img
                src={imageUrl}
                alt={game}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                onError={() => setImgError(true)}
              />
            ) : (
              <span
                className={cn(
                  "text-xl font-black tracking-tighter select-none transition-all duration-500 uppercase",
                  isSelected
                    ? isSpecial
                      ? "text-amber-500 opacity-40"
                      : "text-primary opacity-30"
                    : "text-white opacity-[0.03] group-hover:opacity-10",
                )}
              >
                {isSpecial ? "CN" : game.slice(0, 2)}
              </span>
            )}
          </div>

          {/* Selected Indicator */}
          <AnimatePresence>
            {isSelected && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className={cn(
                  "absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center shadow-lg z-10",
                  isSpecial
                    ? "bg-amber-500 text-amber-950"
                    : "bg-primary text-primary-foreground",
                )}
              >
                <Check className="w-3 h-3 stroke-[5]" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Backup Toggle Overlay */}
          <div
            className={cn(
              "absolute bottom-1.5 right-1.5 z-20 transition-all duration-300",
              isSelected
                ? "opacity-100"
                : "opacity-0 scale-90 pointer-events-none",
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (isSelected) onToggleBackup(game);
            }}
          >
            <div
              className={cn(
                "w-6 h-6 rounded-md flex items-center justify-center transition-all",
                isBackupEnabled
                  ? isSpecial
                    ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                    : "bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.4)]"
                  : "bg-zinc-800/80 hover:bg-zinc-700 text-zinc-500",
              )}
            >
              <Database
                className={cn(
                  "w-3.5 h-3.5",
                  isBackupEnabled ? "text-white" : "",
                )}
              />
            </div>
          </div>

          {/* Folder Size Indication - Moved to Bottom per User Request */}
          <div className="absolute bottom-1.5 left-1.5 z-20">
            <AnimatePresence mode="wait">
              {isLoadingSizes ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-950/80 backdrop-blur-md border border-white/10"
                >
                  <div className="flex gap-0.5">
                    <motion.div
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                      className="w-0.5 h-0.5 rounded-full bg-primary"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                      className="w-0.5 h-0.5 rounded-full bg-primary"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                      className="w-0.5 h-0.5 rounded-full bg-primary"
                    />
                  </div>
                </motion.div>
              ) : (
                folderSize !== undefined &&
                folderSize > 0 && (
                  <motion.div
                    key="size"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-2 py-0.5 rounded-md bg-zinc-950/90 backdrop-blur-md border border-white/20 shadow-lg flex items-center gap-1.5"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
                    <span className="text-[10px] font-black font-mono text-white tracking-wider">
                      {formatBytes(folderSize)}
                    </span>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-0 relative z-10 px-0.5">
          <p
            className={cn(
              "text-[7px] font-bold uppercase tracking-wider transition-colors opacity-50",
              isSelected
                ? isSpecial
                  ? "text-amber-500"
                  : "text-primary"
                : "text-zinc-500",
            )}
          >
            {isSpecial ? "System" : "Ready"}
          </p>
          <p
            className={cn(
              "text-[10px] font-bold transition-colors leading-tight break-words h-[1.9rem] overflow-hidden",
              isSelected ? "text-white" : "text-zinc-400",
            )}
          >
            {game}
          </p>
        </div>
      </motion.div>
    );
  },
);

GameCard.displayName = "GameCard";

interface GameGridProps {
  games: string[];
  selectedGames: string[];
  backupGames: string[];
  gameFolderMap?: Record<string, any>;
  onToggle: (game: string) => void;
  onToggleBackup: (game: string) => void;
  gameSizes?: Record<string, number>;
  loadingSizes?: boolean;
  specialGames?: string[];
}

export function GameGrid({
  games,
  selectedGames,
  backupGames,
  gameFolderMap = {},
  onToggle,
  onToggleBackup,
  gameSizes = {},
  loadingSizes = false,
  specialGames = [],
}: GameGridProps) {
  return (
    <div className="grid grid-cols-5 gap-3 py-2">
      {games.map((game, index) => (
        <motion.div
          key={game}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.3,
            delay: Math.min(index * 0.02, 0.5),
            ease: "easeOut",
          }}
        >
          <GameCard
            game={game}
            gamePath={gameFolderMap[game]?.path}
            imageUrl={gameFolderMap[game]?.image}
            isSelected={selectedGames.includes(game)}
            isBackupEnabled={backupGames.includes(game)}
            onToggle={onToggle}
            onToggleBackup={onToggleBackup}
            isSpecial={specialGames.includes(game)}
            folderSize={
              gameSizes[gameFolderMap[game]?.path || ""] ||
              gameSizes[(gameFolderMap[game]?.path || "").toLowerCase()]
            }
            isLoadingSizes={loadingSizes}
          />
        </motion.div>
      ))}
    </div>
  );
}
