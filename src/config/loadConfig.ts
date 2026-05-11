const fs = require("node:fs");
const path = require("node:path");

const SUPPORTED_ENVS = ["dev", "qa", "preprod"];

function parseDotEnv(dotEnvPath: string): Record<string, string> {
  if (!fs.existsSync(dotEnvPath)) {
    return {};
  }

  const contents = fs.readFileSync(dotEnvPath, "utf8");
  const entries = contents
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line && !line.startsWith("#"))
    .map((line: string) => {
      const splitIndex = line.indexOf("=");
      if (splitIndex === -1) return null;
      const key = line.slice(0, splitIndex).trim();
      const value = line.slice(splitIndex + 1).trim();
      return [key, value];
    })
    .filter(Boolean) as string[][];

  return Object.fromEntries(entries);
}

function resolveRetention(
  envName: string,
  configRetention: Record<string, number>,
  cliRetain: number | null,
  envVars: Record<string, string>
): number {
  if (Number.isInteger(cliRetain) && (cliRetain as number) > 0) {
    return cliRetain as number;
  }

  const envKey = envName === "qa" ? "BACKUP_RETENTION_QA" : "BACKUP_RETENTION_PREPROD";
  const envValue = Number.parseInt(envVars[envKey] ?? process.env[envKey] ?? "", 10);
  if (Number.isInteger(envValue) && envValue > 0) {
    return envValue;
  }

  const configValue = configRetention?.[envName];
  if (Number.isInteger(configValue) && configValue > 0) {
    return configValue;
  }

  return 5;
}

function loadConfig({ rootDir, cliRetain }: { rootDir: string; cliRetain: number | null }) {
  const configPath = path.join(rootDir, "deployment.config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing config file at ${configPath}`);
  }

  const configFile = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const envVars = parseDotEnv(path.join(rootDir, ".env"));
  const sourcePaths = configFile?.paths?.source ?? {};
  const sourcePath = configFile?.paths?.sourcePath ?? null;
  const targetPaths = configFile?.paths?.target ?? {};
  const backupsRoot = configFile?.paths?.backupsRoot ?? "./data/backups";
  const servers = configFile?.servers ?? {};

  const resolvedRetention = Object.fromEntries(
    SUPPORTED_ENVS.map((envName) => [
      envName,
      resolveRetention(envName, configFile.backupRetention, cliRetain, envVars),
    ])
  );

  return {
    paths: {
      source: sourcePaths,
      sourcePath,
      target: targetPaths,
      backupsRoot,
    },
    servers,
    backupRetention: resolvedRetention,
    gameFolderMap: configFile.gameFolderMap || {},
    supportedEnvironments: SUPPORTED_ENVS,
  };
}

module.exports = {
  loadConfig,
  SUPPORTED_ENVS,
};

