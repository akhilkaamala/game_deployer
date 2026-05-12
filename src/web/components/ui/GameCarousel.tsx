import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "../../lib/utils";

interface GameCardProps {
  game: string;
  isSelected: boolean;
  onToggle: (game: string) => void;
}

const GameCard = React.memo(({ game, isSelected, onToggle }: GameCardProps) => {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onToggle(game)}
      className={cn(
        "flex-shrink-0 w-[240px] group relative flex flex-col gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-500 select-none snap-start",
        isSelected
          ? "bg-primary/10 border-primary/40 shadow-[0_20px_40px_rgba(var(--primary-rgb),0.15)]"
          : "bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.08] shadow-sm",
      )}
    >
      <div
        className={cn(
          "w-full aspect-video rounded-xl overflow-hidden relative transition-all duration-500",
          isSelected ? "ring-2 ring-primary/50" : "bg-zinc-900",
        )}
      >
        {/* Placeholder/Thumbnail with Glare Effect */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-all duration-700 group-hover:scale-110",
            isSelected ? "bg-gradient-to-br from-primary/30 to-transparent" : "bg-gradient-to-br from-white/5 to-transparent",
          )}
        >
          <span className="text-[50px] font-black opacity-[0.03] select-none group-hover:opacity-10 transition-opacity">
            {game.slice(0, 2).toUpperCase()}
          </span>
          
          {/* Glare effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -translate-x-full group-hover:translate-x-full transform ease-in-out" />
        </div>

        {/* Selected Indicator */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg z-10"
            >
              <Check className="w-5 h-5 stroke-[3]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      <div className="space-y-1.5 relative z-10">
        <div className="flex items-center justify-between">
          <p
            className={cn(
              "text-[10px] font-black uppercase tracking-[0.2em] transition-colors",
              isSelected ? "text-primary" : "text-zinc-500",
            )}
          >
            Deployment Ready
          </p>
        </div>
        <p
          className={cn(
            "text-sm font-bold truncate transition-colors leading-tight",
            isSelected ? "text-white" : "text-zinc-300",
          )}
        >
          {game}
        </p>
      </div>

      {/* Decorative Glow */}
      <div
        className={cn(
          "absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none",
          isSelected
            ? "bg-gradient-to-br from-primary/20 to-transparent blur-2xl"
            : "bg-gradient-to-br from-white/5 to-transparent blur-xl",
        )}
      />
    </motion.div>
  );
});

GameCard.displayName = "GameCard";

const ScrollIndicator = ({ direction }: { direction: "left" | "right" }) => {
  const colors = ["#f97316", "#a855f7", "#06b6d4", "#d8b4fe", "#3b82f6"];
  const doubleColors = [...colors, ...colors];
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none flex items-center",
        direction === "left" ? "-left-2" : "-right-2"
      )}
    >
      <div className="flex items-center bg-black/90 rounded-full h-10 px-3 border border-white/20 shadow-2xl backdrop-blur-md">
        {direction === "left" && (
          <motion.div
            animate={{ x: [0, -2, 0], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="-ml-1 mr-1 relative z-10 flex items-center"
          >
            <ChevronLeft className="w-7 h-7 text-primary" />
          </motion.div>
        )}

        <div
          className="w-[30px] h-4 overflow-hidden relative shrink-0"
          style={{
            maskImage: direction === "right" 
              ? "linear-gradient(to right, black 30%, transparent 100%)" 
              : "linear-gradient(to left, black 30%, transparent 100%)",
            WebkitMaskImage: direction === "right" 
              ? "linear-gradient(to right, black 30%, transparent 100%)" 
              : "linear-gradient(to left, black 30%, transparent 100%)",
          }}
        >
          <motion.div
            className="flex items-center h-full absolute left-0"
            animate={{ x: direction === "right" ? [-50, 0] : [0, -50] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ width: "100px", gap: "4px" }}
          >
            {doubleColors.map((color, i) => (
              <div
                key={i}
                className="rounded-full shrink-0"
                style={{ 
                  backgroundColor: color,
                  width: "6px",
                  height: "6px"
                }}
              />
            ))}
          </motion.div>
        </div>

        {direction === "right" && (
          <motion.div
            animate={{ x: [0, 2, 0], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="-mr-1 ml-1 relative z-10 flex items-center"
          >
            <ChevronRight className="w-7 h-7 text-primary" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

interface GameCarouselProps {
  games: string[];
  selectedGames: string[];
  onToggle: (game: string) => void;
}

export function GameCarousel({
  games,
  selectedGames,
  onToggle,
}: GameCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const checkOverflow = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    // Use ResizeObserver for more accurate overflow detection
    const observer = new ResizeObserver(checkOverflow);
    if (scrollRef.current) observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, [games, checkOverflow]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      // Scroll by 4 cards exactly
      const cardWidth = 240 + 16; // width + gap
      const scrollAmount = cardWidth * 4;
      
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") scroll("left");
    if (e.key === "ArrowRight") scroll("right");
  };

  return (
    <div 
      className="group/carousel relative -mx-4 px-4 py-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Edge Gradient Fades */}
      <AnimatePresence>
        {canScrollLeft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-0 top-0 bottom-0 w-48 bg-gradient-to-r from-black via-black/40 to-transparent z-10 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {canScrollRight && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute right-0 top-0 bottom-0 w-48 bg-gradient-to-l from-black via-black/40 to-transparent z-10 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Navigation Controls */}
      <AnimatePresence>
        {canScrollLeft && isHovered && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            whileHover={{ scale: 1.1, backgroundColor: "rgba(var(--primary-rgb), 0.9)" }}
            whileTap={{ scale: 0.9 }}
            onClick={() => scroll("left")}
            className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-zinc-900/90 border border-white/10 flex items-center justify-center text-white z-20 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 group/btn"
          >
            <ChevronLeft className="w-7 h-7 transition-transform group-hover/btn:-translate-x-0.5" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {canScrollRight && isHovered && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            whileHover={{ scale: 1.1, backgroundColor: "rgba(var(--primary-rgb), 0.9)" }}
            whileTap={{ scale: 0.9 }}
            onClick={() => scroll("right")}
            className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-zinc-900/90 border border-white/10 flex items-center justify-center text-white z-20 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-300 group/btn"
          >
            <ChevronRight className="w-7 h-7 transition-transform group-hover/btn:translate-x-0.5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Animated Scroll Indicators */}
      <AnimatePresence>
        {canScrollLeft && <ScrollIndicator direction="left" />}
      </AnimatePresence>
      <AnimatePresence>
        {canScrollRight && <ScrollIndicator direction="right" />}
      </AnimatePresence>

      {/* Scrolling Container */}
      <div
        ref={scrollRef}
        onScroll={checkOverflow}
        className="flex gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory py-4 outline-none"
      >
        {games.map((game, index) => (
          <motion.div
            key={game}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ 
              duration: 0.5, 
              delay: index * 0.05,
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
    </div>
  );
}
