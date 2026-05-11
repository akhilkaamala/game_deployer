const fs = require("node:fs/promises");
const path = require("node:path");

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toAbsolutePath(rootDir: string, maybeRelativePath?: string | null): string | null {
  if (!maybeRelativePath) {
    return null;
  }
  return path.isAbsolute(maybeRelativePath)
    ? maybeRelativePath
    : path.resolve(rootDir, maybeRelativePath);
}

module.exports = {
  ensureDir,
  pathExists,
  toAbsolutePath,
};

