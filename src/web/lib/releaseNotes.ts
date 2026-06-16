import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ServerInfo {
  host: string;
  siteUrl?: string;
  destinationName?: string;
}

export interface ReleaseNotesRow {
  component: string;
  change: string;
  source: string;
  sourceIp: string;
  sourcePath: string;
  destination: string;
  type: string;
  destinationPath: string;
}

export interface ClientStep {
  step: number;
  description: string;
}

const RELEASE_NOTES_SOURCE_ENV = "preprod" as const;
const RELEASE_NOTES_SOURCE_LABEL = "Preprod";

const FIXED_SOURCE = "sourcelink";
const FIXED_SOURCE_IP = "3.73.207.133";
const FIXED_DESTINATION = "Blaze Aggregator";
const FIXED_TYPE = "site";

const DEPLOYMENT_HEADERS = [
  "Component",
  "Change",
  "Source",
  "Source IP address",
  "Source path",
  "Destination",
  "Type",
  "Destination path",
] as const;

const MERGED_COLS = [3, 4, 6, 7] as const;
const COL_COUNT = 8;

const BORDER_THIN = {
  top: { style: "thin" as const },
  left: { style: "thin" as const },
  bottom: { style: "thin" as const },
  right: { style: "thin" as const },
};

export interface ReleaseNotesData {
  deploymentRows: ReleaseNotesRow[];
  clientSteps: ClientStep[];
  generatedAt: string;
}

function resolveFolder(
  game: string,
  gameFolderMap: Record<string, string | { path: string; jsonExt: string }>,
): string {
  if (game === "content") return "content";
  const entry = gameFolderMap[game];
  if (!entry) return game;
  return typeof entry === "string" ? entry : entry.path;
}

function sortGamesForReleaseNotes(games: string[]): string[] {
  const withoutContent = games.filter((g) => g !== "content");
  return games.includes("content")
    ? [...withoutContent, "content"]
    : withoutContent;
}

export function buildReleaseNotes({
  selectedGames,
  gameFolderMap,
  serverBasePaths,
  serverInfo,
}: {
  selectedGames: string[];
  gameFolderMap: Record<string, string | { path: string; jsonExt: string }>;
  serverBasePaths: Record<string, string>;
  serverInfo: Record<string, ServerInfo>;
}): ReleaseNotesData {
  const preprod = serverInfo[RELEASE_NOTES_SOURCE_ENV];
  const serverBase = serverBasePaths[RELEASE_NOTES_SOURCE_ENV] || "";
  const orderedGames = sortGamesForReleaseNotes(selectedGames);

  const deploymentRows: ReleaseNotesRow[] = orderedGames.map((game) => {
    const folder = resolveFolder(game, gameFolderMap);
    const sourcePath = `${serverBase}/${folder}`.replace(/\/+/g, "/");
    const destinationPath = preprod?.siteUrl
      ? `${preprod.siteUrl}/${folder}`
      : sourcePath;

    return {
      component: folder,
      change: "",
      source: FIXED_SOURCE,
      sourceIp: FIXED_SOURCE_IP,
      sourcePath,
      destination: FIXED_DESTINATION,
      type: FIXED_TYPE,
      destinationPath,
    };
  });

  const clientSteps: ClientStep[] = [
    { step: 1, description: `Sync files from ${RELEASE_NOTES_SOURCE_LABEL}.` },
    {
      step: 2,
      description: "Kindly give access permission to the folder",
    },
  ];

  return {
    deploymentRows,
    clientSteps,
    generatedAt: new Date().toISOString(),
  };
}

function formatFileName(data: ReleaseNotesData): string {
  const d = new Date(data.generatedAt);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `Client_Agr_Release_Notes_${dd}-${mm}-${yyyy}`;
}

function borderRow(row: ExcelJS.Row): void {
  for (let c = 1; c <= COL_COUNT; c++) {
    row.getCell(c).border = BORDER_THIN;
  }
}

function countDeploymentBodyRows(gameCount: number): number {
  if (gameCount === 0) return 0;
  return gameCount * 2 - 1;
}

type PdfCell =
  | string
  | {
      content: string;
      rowSpan?: number;
      colSpan?: number;
      styles?: { valign?: "middle"; fontStyle?: "bold" };
    };

function buildDeploymentPdfBody(rows: ReleaseNotesRow[]): PdfCell[][] {
  if (rows.length === 0) return [];

  const rowSpan = countDeploymentBodyRows(rows.length);
  const body: PdfCell[][] = [];

  rows.forEach((game, index) => {
    if (index > 0) {
      body.push(Array(COL_COUNT).fill(""));
    }

    if (index === 0) {
      body.push([
        game.component,
        "",
        {
          content: FIXED_SOURCE,
          rowSpan,
          styles: { valign: "middle" },
        },
        {
          content: FIXED_SOURCE_IP,
          rowSpan,
          styles: { valign: "middle" },
        },
        game.sourcePath,
        {
          content: FIXED_DESTINATION,
          rowSpan,
          styles: { valign: "middle" },
        },
        {
          content: FIXED_TYPE,
          rowSpan,
          styles: { valign: "middle" },
        },
        game.destinationPath,
      ]);
      return;
    }

    body.push([
      game.component,
      "",
      "",
      "",
      game.sourcePath,
      "",
      "",
      game.destinationPath,
    ]);
  });

  return body;
}

export async function downloadReleaseNotesExcel(
  data: ReleaseNotesData,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Slots");

  sheet.columns = [
    { width: 18 },
    { width: 10 },
    { width: 14 },
    { width: 18 },
    { width: 52 },
    { width: 18 },
    { width: 10 },
    { width: 42 },
  ];

  const headerRowNum = 4;
  const headerRow = sheet.getRow(headerRowNum);
  DEPLOYMENT_HEADERS.forEach((label, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true };
    cell.border = BORDER_THIN;
  });

  let currentRow = headerRowNum + 1;
  const dataStartRow = currentRow;
  const { deploymentRows } = data;

  deploymentRows.forEach((game, index) => {
    if (index > 0) {
      borderRow(sheet.getRow(currentRow));
      currentRow++;
    }

    const row = sheet.getRow(currentRow);
    row.getCell(1).value = game.component;
    row.getCell(2).value = game.change || "";
    if (index === 0) {
      row.getCell(3).value = FIXED_SOURCE;
      row.getCell(4).value = FIXED_SOURCE_IP;
      row.getCell(6).value = FIXED_DESTINATION;
      row.getCell(7).value = FIXED_TYPE;
    }
    row.getCell(5).value = game.sourcePath;
    row.getCell(8).value = game.destinationPath;
    borderRow(row);
    currentRow++;
  });

  const dataEndRow = currentRow - 1;
  if (deploymentRows.length > 0) {
    for (const col of MERGED_COLS) {
      sheet.mergeCells(dataStartRow, col, dataEndRow, col);
      sheet.getCell(dataStartRow, col).alignment = {
        vertical: "middle",
        horizontal: "left",
      };
    }
  }

  const stepsHeaderRowNum = dataEndRow + 2;
  const stepsHeader = sheet.getRow(stepsHeaderRowNum);
  stepsHeader.getCell(1).value = "Step";
  stepsHeader.getCell(2).value = "Steps to be done - Client";
  stepsHeader.getCell(1).font = { bold: true };
  stepsHeader.getCell(2).font = { bold: true };
  sheet.mergeCells(stepsHeaderRowNum, 2, stepsHeaderRowNum, COL_COUNT);
  borderRow(stepsHeader);

  data.clientSteps.forEach((step, index) => {
    const rowNum = stepsHeaderRowNum + 1 + index;
    const row = sheet.getRow(rowNum);
    row.getCell(1).value = step.step;
    row.getCell(2).value = step.description;
    row.getCell(2).font = { bold: true };
    sheet.mergeCells(rowNum, 2, rowNum, COL_COUNT);
    borderRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${formatFileName(data)}.xlsx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadReleaseNotesPdf(data: ReleaseNotesData): void {
  const doc = new jsPDF({ orientation: "landscape" });

  autoTable(doc, {
    startY: 14,
    head: [[...DEPLOYMENT_HEADERS]],
    body: buildDeploymentPdfBody(data.deploymentRows),
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    theme: "grid",
  });

  const afterDeployment =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 14;

  autoTable(doc, {
    startY: afterDeployment + 8,
    head: [
      [
        {
          content: "Step",
          styles: { fontStyle: "bold", halign: "left" },
        },
        {
          content: "Steps to be done - Client",
          colSpan: 7,
          styles: { fontStyle: "bold", halign: "left" },
        },
      ],
    ],
    body: data.clientSteps.map((step) => [
      String(step.step),
      {
        content: step.description,
        colSpan: 7,
        styles: { fontStyle: "bold", halign: "left" },
      },
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    theme: "grid",
    columnStyles: { 0: { cellWidth: 16 } },
  });

  doc.save(`${formatFileName(data)}.pdf`);
}
