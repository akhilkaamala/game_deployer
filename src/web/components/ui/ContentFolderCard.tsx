import React from "react";
import { motion } from "framer-motion";
import { Database, Check, ShieldCheck, Box } from "lucide-react";
import { cn } from "../../lib/utils";
import { Card, CardContent } from "../ui/Card";

interface ContentFolderCardProps {
  isSelected: boolean;
  isBackupEnabled: boolean;
  onToggle: () => void;
  onToggleBackup: () => void;
  isDeploying?: boolean;
}

export function ContentFolderCard({
  isSelected,
  isBackupEnabled,
  onToggle,
  onToggleBackup,
  isDeploying = false,
}: ContentFolderCardProps) {
  return (
    <Card
      className={cn(
        "border-white/10 bg-white/5 backdrop-blur-md transition-all duration-500 overflow-hidden group cursor-pointer",
        isSelected
          ? "ring-2 ring-amber-500/30 border-amber-500/20"
          : "hover:border-white/20",
      )}
      onClick={onToggle}
    >
      <CardContent className="p-4 flex items-center gap-6">
        <div className="relative">
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500",
              isSelected
                ? "bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                : "bg-white/5",
            )}
          >
            <Box
              className={cn(
                "w-6 h-6 transition-colors",
                isSelected ? "text-amber-950" : "text-zinc-500",
              )}
            />
          </div>
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-zinc-950"
            >
              <Check className="w-3 h-3 text-amber-950 stroke-[4]" />
            </motion.div>
          )}
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-tight">
              Content / Core JSON
            </h3>
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
              SYSTEM
            </span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-tight max-w-[200px]">
            Core project assets, localization, and global configurations.
          </p>
        </div>

        <div className="flex items-center gap-3 pr-2">
          <div
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-2 rounded-lg border transition-all group/backup",
              !isSelected ? "opacity-40 cursor-not-allowed pointer-events-none grayscale" : "",
              isBackupEnabled
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                : "bg-white/5 border-white/5 text-zinc-500 hover:bg-white/10 hover:border-white/10",
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (isSelected) onToggleBackup();
            }}
          >
            <Database
              className={cn(
                "w-4 h-4 transition-transform",
                isBackupEnabled ? "scale-110" : "group-hover/backup:scale-110",
              )}
            />
            <span className="text-[9px] font-black uppercase tracking-widest">
              Backup
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
