import React from "react";
import { Badge } from "./ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import {
  Package,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  History,
  Database,
  FileCode,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { DeployEnvironment } from "../types";

interface DeploymentSummaryProps {
  source: DeployEnvironment;
  target: DeployEnvironment;
  selectedGames: string[];
  backupGames: string[];
  retention: string;
  gameFolderMap: Record<string, any>;
  serverBasePaths: Record<string, string>;
  jsonRootPaths: Record<string, string>;
}

export function DeploymentSummary({
  source,
  target,
  selectedGames,
  backupGames,
  retention,
  gameFolderMap,
  serverBasePaths,
  jsonRootPaths,
}: DeploymentSummaryProps) {
  const isContentSelected = selectedGames.includes("content");
  const isContentBackupEnabled = backupGames.includes("content");
  const gameBackupsCount = backupGames.filter((g) => g !== "content").length;
  const otherGamesCount = selectedGames.filter((g) => g !== "content").length;

  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <Package className="w-32 h-32 rotate-12" />
      </div>

      <CardHeader className="border-b border-white/10 bg-white/5">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          Deployment Manifest
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/50 border border-white/5 shadow-inner">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">
              Source
            </span>
            <Badge variant={source as any} className="w-fit">
              {source?.toUpperCase() || "..."}
            </Badge>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-700" />
          <div className="flex flex-col gap-1 items-end">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">
              Target
            </span>
            <Badge variant={target as any} className="w-fit">
              {target?.toUpperCase() || "..."}
            </Badge>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-zinc-400">
              <FileCode className="w-4 h-4" />
              <span>Total Games</span>
            </div>
            <span className="font-mono font-bold text-primary">
              {selectedGames.length}
            </span>
          </div>

          {/* Game Backups */}
          <div
            className={cn(
              "flex items-center justify-between text-sm transition-opacity",
              otherGamesCount === 0 ? "opacity-40 grayscale" : "opacity-100",
            )}
          >
            <div className="flex items-center gap-2 text-zinc-400">
              {gameBackupsCount > 0 ? (
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-zinc-600" />
              )}
              <span>Game Backups</span>
            </div>
            <Badge variant={gameBackupsCount > 0 ? "success" : "secondary"}>
              {gameBackupsCount} {gameBackupsCount === 1 ? "GAME" : "GAMES"}
            </Badge>
          </div>

          {/* Content Backup */}
          <div
            className={cn(
              "flex items-center justify-between text-sm transition-opacity",
              !isContentSelected ? "opacity-40 grayscale" : "opacity-100",
            )}
          >
            <div className="flex items-center gap-2 text-zinc-400">
              {isContentBackupEnabled ? (
                <ShieldCheck className="w-4 h-4 text-amber-500" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-zinc-600" />
              )}
              <span>Content Backup</span>
            </div>
            <Badge variant={isContentBackupEnabled ? "amber" : "secondary"}>
              {isContentBackupEnabled ? "ENABLED" : "DISABLED"}
            </Badge>
          </div>

          <div
            className={cn(
              "flex items-center justify-between text-sm transition-opacity",
              gameBackupsCount === 0 ? "opacity-40 grayscale" : "opacity-100",
            )}
          >
            <div className="flex items-center gap-2 text-zinc-400">
              <Database className="w-4 h-4" />
              <span>Retention Policy</span>
            </div>
            <span className="font-mono text-zinc-300">
              {retention || "3"} snapshots
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 space-y-3">
          <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <History className="w-3 h-3" />
            Path Resolution
          </h4>
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin">
            {selectedGames.map((game) => {
              const isContentFolder = game === "content";
              const gameData = isContentFolder ? null : gameFolderMap[game];
              const hasBackup = backupGames.includes(game);

              const folder = isContentFolder
                ? "content"
                : gameData
                  ? typeof gameData === "string"
                    ? gameData
                    : gameData.path
                  : game;
              const jsonExt = isContentFolder
                ? "/content"
                : gameData && typeof gameData !== "string"
                  ? gameData.jsonExt
                  : ".json";

              const sourcePath =
                `${serverBasePaths[source] || ""}/${folder}`.replace(
                  /\/+/g,
                  "/",
                );
              const targetPath =
                `${serverBasePaths[target] || ""}/${folder}`.replace(
                  /\/+/g,
                  "/",
                );

              const isPathPrefix = jsonExt.startsWith("/");
              const jsonSubPath = isPathPrefix
                ? jsonExt
                : `/${folder}${jsonExt}`;

              const sourceJson =
                `${jsonRootPaths[source] || serverBasePaths[source] + "/json"}${jsonSubPath}`.replace(
                  /\/+/g,
                  "/",
                );
              const targetJson =
                `${jsonRootPaths[target] || serverBasePaths[target] + "/json"}${jsonSubPath}`.replace(
                  /\/+/g,
                  "/",
                );

              return (
                <div
                  key={game}
                  className={cn(
                    "p-3 rounded-lg border text-[10px] space-y-3 relative transition-all",
                    isContentFolder
                      ? "bg-amber-500/5 border-amber-500/20"
                      : "bg-white/5 border-white/5",
                  )}
                >
                  {hasBackup && (
                    <div className="absolute top-0 right-0 p-1 bg-primary/20 text-primary border-b border-l border-primary/20 rounded-bl-lg">
                      <Database className="w-2.5 h-2.5" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 font-bold text-zinc-200 border-b border-white/5 pb-1">
                    {isContentFolder ? (
                      <span className="text-amber-500">
                        SYSTEM: CONTENT FOLDER
                      </span>
                    ) : (
                      game
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-[9px] text-zinc-500 uppercase font-bold">
                      Game Directory
                    </div>
                    <div className="flex flex-col gap-1 pl-2 border-l border-blue-500/30">
                      <div className="break-all opacity-80 font-mono leading-relaxed">
                        <span className="text-blue-400 mr-1">SRC:</span>
                        {sourcePath}
                      </div>
                      <div className="break-all opacity-80 font-mono leading-relaxed">
                        <span className="text-emerald-400 mr-1">DST:</span>
                        {targetPath}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {selectedGames.length === 0 && (
              <div className="text-center py-4 text-zinc-600 italic">
                No games selected
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
