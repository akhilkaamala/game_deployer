function parseArgs(argv: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [rawKey, rawValue] = arg.slice(2).split("=");
    const key = rawKey.trim();
    const value = rawValue === undefined ? true : rawValue.trim();
    result[key] = value;
  }
  return result;
}

function normalizeEnv(value: unknown): string | null {
  if (!value) return null;
  const env = String(value).toLowerCase();
  if (env === "pre-prod") return "preprod";
  return env;
}

function toInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

module.exports = {
  parseArgs,
  normalizeEnv,
  toInteger,
};

