import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ClipboardList, Gamepad2 } from "lucide-react";
import { fetchConfig } from "../api";
import type { ConfigResponse } from "../types";
import { GameSelector } from "./ui/GameSelector";
import { ContentFolderCard } from "./ui/ContentFolderCard";
import { ReleaseNotes } from "./ReleaseNotes";
import { Badge } from "./ui/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/Card";
import { cn } from "../lib/utils";
import { DEFAULT_CLIENT_STEPS } from "../lib/releaseNotes";

export function ReleaseNotesManager() {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [clientSteps, setClientSteps] = useState<string[]>(DEFAULT_CLIENT_STEPS);
  const [loading, setLoading] = useState(true);

  const gamesList = useMemo(() => {
    if (!config?.gameFolderMap) return [];
    return Object.keys(config.gameFolderMap);
  }, [config]);

  const toggleGame = useCallback((game: string) => {
    setSelectedGames((prev) =>
      prev.includes(game) ? prev.filter((g) => g !== game) : [...prev, game],
    );
  }, []);

  const loadConfig = useCallback(() => {
    setLoading(true);
    fetchConfig()
      .then((data) => setConfig(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const handler = () => loadConfig();
    window.addEventListener("gamesConfigUpdated", handler);
    return () => window.removeEventListener("gamesConfigUpdated", handler);
  }, [loadConfig]);

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-zinc-500 text-sm">
        Loading release notes workspace...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-primary/10 via-transparent to-emerald-500/5 p-6"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-3xl rounded-full pointer-events-none" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <ClipboardList className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">
                Client Release Notes
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Preprod to Production Handoff
            </h2>
            <p className="text-sm text-zinc-400 max-w-2xl">
              Select games on the left to build the deployment table and client
              steps. Export the final document as Excel or PDF.
            </p>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-950/50 border border-white/10">
            <Badge variant="amber" className="h-7 px-3">
              PREPROD
            </Badge>
            <ArrowRight className="w-4 h-4 text-zinc-500" />
            <Badge variant="success" className="h-7 px-3">
              PROD
            </Badge>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[calc(100vh-18rem)]">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-5 flex flex-col gap-4 min-h-0"
        >
          <ContentFolderCard
            isSelected={selectedGames.includes("content")}
            isBackupEnabled={false}
            onToggle={() => toggleGame("content")}
            onToggleBackup={() => {}}
            hideBackup
          />

          <Card className="border-white/10 bg-white/5 backdrop-blur-md flex-1 min-h-[620px] flex flex-col overflow-hidden">
            <CardHeader className="border-b border-white/10 bg-white/5 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4 text-primary" />
                    Game Selection
                  </CardTitle>
                  <CardDescription>
                    Choose games to include in the release notes
                  </CardDescription>
                </div>
                <Badge variant="outline" className="h-6 whitespace-nowrap">
                  {selectedGames.length} SELECTED
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 p-4">
              <GameSelector
                games={gamesList}
                selectedGames={selectedGames}
                backupGames={[]}
                gameFolderMap={config?.gameFolderMap ?? {}}
                onToggle={toggleGame}
                onToggleBackup={() => {}}
                onSelectAll={setSelectedGames}
                onDeselectAll={() => setSelectedGames([])}
                onSelectBackups={() => {}}
                onDeselectBackups={() => {}}
                hideBackup
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className={cn("xl:col-span-7 min-h-0 flex flex-col")}
        >
          <ReleaseNotes
            selectedGames={selectedGames}
            gameFolderMap={config?.gameFolderMap ?? {}}
            serverBasePaths={config?.serverBasePaths ?? {}}
            serverInfo={config?.serverInfo ?? {}}
            className="flex-1 min-h-[620px]"
            onClearSelection={() => {
              setSelectedGames([]);
              setClientSteps(DEFAULT_CLIENT_STEPS);
            }}
            clientSteps={clientSteps}
            onClientStepsChange={setClientSteps}
          />
        </motion.div>
      </div>
    </div>
  );
}
