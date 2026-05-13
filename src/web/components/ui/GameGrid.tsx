import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface GameCardProps {
  game: string;
  isSelected: boolean;
  onToggle: (game: string) => void;
}

const GameCard = React.memo(({ game, isSelected, onToggle }: GameCardProps) => {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onToggle(game)}
      className={cn(
        "group relative flex flex-col gap-1.5 p-1.5 rounded-lg border cursor-pointer transition-all duration-300 select-none h-full",
        isSelected
          ? "bg-primary/10 border-primary/40 shadow-md shadow-primary/5"
          : "bg-white/[0.01] border-white/5 hover:border-white/10 hover:bg-white/[0.03]",
      )}
    >
      <div
        className={cn(
          "w-full aspect-square rounded-md overflow-hidden relative transition-all duration-500 bg-zinc-900/50",
          isSelected ? "ring-1 ring-primary/30" : "",
        )}
      >
        {/* Placeholder/Thumbnail */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-all duration-700",
            isSelected ? "bg-primary/10" : "bg-white/[0.02]",
          )}
        >
          <span 
            className={cn(
              "text-xl font-black tracking-tighter select-none transition-all duration-500",
              isSelected ? "text-primary opacity-30" : "text-white opacity-[0.03] group-hover:opacity-10"
            )}
          >
            {game.slice(0, 2).toUpperCase()}
          </span>
        </div>

        {/* Selected Indicator */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg z-10"
            >
              <Check className="w-3 h-3 stroke-[5]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-0 relative z-10 px-0.5">
        <p
          className={cn(
            "text-[7px] font-bold uppercase tracking-wider transition-colors opacity-50",
            isSelected ? "text-primary" : "text-zinc-500",
          )}
        >
          Ready
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
});

GameCard.displayName = "GameCard";

interface GameGridProps {
  games: string[];
  selectedGames: string[];
  onToggle: (game: string) => void;
}

export function GameGrid({
  games,
  selectedGames,
  onToggle,
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
            ease: "easeOut"
          }}
        >
          <GameCard
            game={game}
            isSelected={selectedGames.includes(game)}
            onToggle={onToggle}
          />
        </motion.div>
      ))}
    </div>
  );
}
