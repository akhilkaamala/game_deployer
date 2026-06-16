import React, { useMemo } from "react";
import { FileSpreadsheet, FileText, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";
import {
  buildReleaseNotes,
  downloadReleaseNotesExcel,
  downloadReleaseNotesPdf,
  type ServerInfo,
} from "../lib/releaseNotes";

interface ReleaseNotesProps {
  selectedGames: string[];
  gameFolderMap: Record<string, string | { path: string; jsonExt: string }>;
  serverBasePaths: Record<string, string>;
  serverInfo: Record<string, ServerInfo>;
}

const COLUMNS = [
  { key: "component", label: "Component", className: "min-w-[120px]" },
  { key: "change", label: "Change", className: "min-w-[80px]" },
  { key: "source", label: "Source", className: "min-w-[90px]" },
  { key: "sourceIp", label: "Source IP address", className: "min-w-[120px]" },
  { key: "sourcePath", label: "Source path", className: "min-w-[200px]" },
  { key: "destination", label: "Destination", className: "min-w-[120px]" },
  { key: "type", label: "Type", className: "min-w-[60px]" },
  {
    key: "destinationPath",
    label: "Destination path",
    className: "min-w-[200px]",
  },
] as const;

export function ReleaseNotes({
  selectedGames,
  gameFolderMap,
  serverBasePaths,
  serverInfo,
}: ReleaseNotesProps) {
  const data = useMemo(
    () =>
      buildReleaseNotes({
        selectedGames,
        gameFolderMap,
        serverBasePaths,
        serverInfo,
      }),
    [selectedGames, gameFolderMap, serverBasePaths, serverInfo],
  );

  const hasSelection = selectedGames.length > 0;

  return (
    <Card className="border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
      <CardHeader className="border-b border-white/10 bg-white/5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            Release Notes
            <span className="text-[10px] font-bold text-zinc-500 normal-case tracking-normal">
              (Preprod → Prod)
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-white/10 bg-white/5"
              disabled={!hasSelection}
              onClick={() => void downloadReleaseNotesExcel(data)}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-white/10 bg-white/5"
              disabled={!hasSelection}
              onClick={() => downloadReleaseNotesPdf(data)}
            >
              <FileText className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {!hasSelection ? (
          <div className="p-8 text-center text-zinc-500 italic text-sm">
            Select games to generate release notes
          </div>
        ) : (
          <div className="space-y-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-white/10">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "px-3 py-2.5 font-bold text-zinc-400 uppercase tracking-wider whitespace-nowrap",
                          col.className,
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.deploymentRows.map((row, idx) => (
                    <tr
                      key={`${row.component}-${idx}`}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      {COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-3 py-2.5 font-mono text-zinc-300 align-top break-all",
                            col.key === "component" &&
                              "font-bold text-blue-400",
                            col.key === "destinationPath" &&
                              "text-emerald-400/90",
                          )}
                        >
                          {row[col.key] || (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-white/10">
              <div className="px-4 py-3 bg-zinc-900/40 border-b border-white/5">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Steps to be done — Client
                </h4>
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-900/60 border-b border-white/10">
                    <th className="px-4 py-2 w-16 font-bold text-zinc-400 uppercase">
                      Step
                    </th>
                    <th className="px-4 py-2 font-bold text-zinc-400 uppercase">
                      Steps to be done — Client
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.clientSteps.map((step) => (
                    <tr
                      key={step.step}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="px-4 py-2.5 font-mono text-zinc-400">
                        {step.step}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-2.5 text-zinc-200",
                          step.step === 2 && "font-bold",
                        )}
                      >
                        {step.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
