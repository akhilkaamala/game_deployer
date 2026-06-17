import React, { useMemo, useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  ClipboardList,
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Pencil,
  Eye,
} from "lucide-react";
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
  className?: string;
  onClearSelection?: () => void;
  clientSteps?: string[];
  onClientStepsChange?: (steps: string[]) => void;
}

const COLUMNS = [
  { key: "component", label: "Component", className: "min-w-[200px]" },
  { key: "change", label: "Change", className: "min-w-[80px]" },
  { key: "source", label: "Source", className: "min-w-[95px]" },
  { key: "sourceIp", label: "Source IP address", className: "min-w-[120px]" },
  { key: "sourcePath", label: "Source path", className: "min-w-[200px]" },
  { key: "destination", label: "Destination", className: "min-w-[140px]" },
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
  className,
  onClearSelection,
  clientSteps = [],
  onClientStepsChange,
}: ReleaseNotesProps) {
  const [stepsEditMode, setStepsEditMode] = useState(true);

  const data = useMemo(
    () =>
      buildReleaseNotes({
        selectedGames,
        gameFolderMap,
        serverBasePaths,
        serverInfo,
        clientSteps,
      }),
    [selectedGames, gameFolderMap, serverBasePaths, serverInfo, clientSteps],
  );

  const hasSelection = selectedGames.length > 0;

  const updateClientStep = (index: number, value: string) => {
    if (!onClientStepsChange) return;
    const next = [...clientSteps];
    next[index] = value;
    onClientStepsChange(next);
  };

  const removeClientStep = (index: number) => {
    if (!onClientStepsChange) return;
    onClientStepsChange(clientSteps.filter((_, i) => i !== index));
  };

  const addClientStep = () => {
    if (!onClientStepsChange) return;
    onClientStepsChange([...clientSteps, ""]);
  };

  const moveClientStep = (index: number, direction: "up" | "down") => {
    if (!onClientStepsChange) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= clientSteps.length) return;
    const next = [...clientSteps];
    [next[index], next[target]] = [next[target], next[index]];
    onClientStepsChange(next);
  };

  return (
    <Card
      className={cn(
        "border-white/10 bg-white/5 backdrop-blur-md overflow-hidden flex flex-col",
        className,
      )}
    >
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
            {onClearSelection && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-white/10 bg-white/5 text-zinc-400 hover:text-white"
                disabled={!hasSelection}
                onClick={onClearSelection}
              >
                <X className="w-4 h-4" />
                Clear
              </Button>
            )}
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

      <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
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
                    <React.Fragment key={`${row.component}-${idx}`}>
                      {row.component === "content" && idx > 0 && (
                        <tr aria-hidden="true">
                          <td
                            colSpan={COLUMNS.length}
                            className="h-4 border-b border-white/5 bg-transparent"
                          />
                        </tr>
                      )}
                      <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        {COLUMNS.map((col) => (
                          <td
                            key={col.key}
                            className={cn(
                              "px-3 py-2.5 font-mono text-zinc-300 align-top",
                              col.key === "component" &&
                                "font-bold text-blue-400 whitespace-nowrap",
                              col.key !== "component" && "break-all",
                              col.key === "source" && "whitespace-nowrap",
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
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-white/10">
              <div className="px-4 py-3 bg-zinc-900/40 border-b border-white/5 flex items-center justify-between gap-3">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Steps to be done — Client
                </h4>
                <div className="flex items-center gap-2">
                  {onClientStepsChange && (
                    <button
                      type="button"
                      onClick={() => setStepsEditMode((prev) => !prev)}
                      className="p-1.5 rounded-md border border-white/10 bg-zinc-950/40 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                      title={
                        stepsEditMode ? "Switch to view" : "Switch to edit"
                      }
                    >
                      {stepsEditMode ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <Pencil className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  {onClientStepsChange && stepsEditMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 border-white/10 bg-white/5 text-xs"
                      onClick={addClientStep}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Step
                    </Button>
                  )}
                </div>
              </div>
              <table className="w-full text-left text-xs table-fixed border-collapse">
                <thead>
                  <tr className="bg-zinc-900/60 border-b border-white/10">
                    <th className="w-14 px-3 py-2 font-bold text-zinc-400 uppercase text-center">
                      Step
                    </th>
                    <th className="px-3 py-2 font-bold text-zinc-400 uppercase">
                      Steps to be done — Client
                    </th>
                    {onClientStepsChange && stepsEditMode && (
                      <th className="w-28 px-3 py-2 font-bold text-zinc-400 uppercase text-center">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {stepsEditMode ? (
                    clientSteps.length === 0 ? (
                      <tr>
                        <td
                          colSpan={onClientStepsChange ? 3 : 2}
                          className="px-3 py-6 text-center text-zinc-500 italic"
                        >
                          No client steps. Add a step to get started.
                        </td>
                      </tr>
                    ) : (
                      clientSteps.map((text, index) => (
                        <tr
                          key={`client-step-${index}`}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="px-3 py-2 font-mono text-zinc-400 text-center align-middle">
                            {index + 1}
                          </td>
                          <td className="px-3 py-2 align-middle">
                            <input
                              value={text}
                              onChange={(e) =>
                                updateClientStep(index, e.target.value)
                              }
                              placeholder="Enter step description..."
                              className="w-full rounded-md border border-white/10 bg-zinc-950/50 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                          </td>
                          {onClientStepsChange && (
                            <td className="px-3 py-2 align-middle">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => moveClientStep(index, "up")}
                                  disabled={index === 0}
                                  className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                  title="Move up"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveClientStep(index, "down")}
                                  disabled={index === clientSteps.length - 1}
                                  className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                  title="Move down"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeClientStep(index)}
                                  className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  title="Remove step"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )
                  ) : data.clientSteps.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-3 py-6 text-center text-zinc-500 italic"
                      >
                        No client steps defined.
                      </td>
                    </tr>
                  ) : (
                    data.clientSteps.map((step) => (
                      <tr
                        key={`client-step-view-${step.step}`}
                        className="border-b border-white/5 last:border-0"
                      >
                        <td className="px-3 py-2.5 font-mono text-zinc-400 text-center align-middle">
                          {step.step}
                        </td>
                        <td className="px-3 py-2.5 text-zinc-200 align-middle">
                          {step.description}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
