import fs from "node:fs/promises";
import path from "node:path";

export const METADATA_FILE = "backup.meta.json";

export async function writeMetadata(backupPath: string, metadata: Record<string, unknown>): Promise<void> {
  const filePath = path.join(backupPath, METADATA_FILE);
  await fs.writeFile(filePath, JSON.stringify(metadata, null, 2), "utf8");
}

export async function readMetadata(backupPath: string): Promise<Record<string, unknown> | null> {
  const filePath = path.join(backupPath, METADATA_FILE);
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
