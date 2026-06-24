import fs from "node:fs";
import path from "node:path";

export interface LocalDeploymentConfig {
  sshKeys?: Record<string, string>;
}

export function localConfigPath(rootDir: string): string {
  return path.join(rootDir, "deployment.local.json");
}

export function readLocalConfig(rootDir: string): LocalDeploymentConfig {
  const filePath = localConfigPath(rootDir);
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

export function writeLocalConfig(
  rootDir: string,
  config: LocalDeploymentConfig,
): void {
  fs.writeFileSync(localConfigPath(rootDir), JSON.stringify(config, null, 2));
}

export function getAllSshKeys(rootDir: string): Record<string, string> {
  return { ...(readLocalConfig(rootDir).sshKeys || {}) };
}

export function getSshKeyPath(rootDir: string, envName: string): string | null {
  const key = getAllSshKeys(rootDir)[envName];
  return key?.trim() || null;
}

export function setSshKeyPath(
  rootDir: string,
  envName: string,
  keyPath: string | null,
): void {
  const local = readLocalConfig(rootDir);
  if (!local.sshKeys) local.sshKeys = {};
  if (keyPath?.trim()) {
    local.sshKeys[envName] = keyPath.trim();
  } else {
    delete local.sshKeys[envName];
  }
  writeLocalConfig(rootDir, local);
}

export function resolveKeyPath(
  rootDir: string,
  key: string | null | undefined,
): string {
  if (!key?.trim()) return "";
  const trimmed = key.trim();
  if (path.isAbsolute(trimmed)) return trimmed;
  return path.resolve(rootDir, trimmed);
}

export function bootstrapKeyPath(rootDir: string, envName: string): string {
  const bootstrapKey = path.join(rootDir, "keys", `${envName}.pem`);
  return fs.existsSync(bootstrapKey) ? bootstrapKey : "";
}

export function resolveServerKey(
  rootDir: string,
  envName: string,
  configKey?: string | null,
): string {
  const localKey = getSshKeyPath(rootDir, envName);
  if (localKey) return resolveKeyPath(rootDir, localKey);
  if (configKey?.trim()) return resolveKeyPath(rootDir, configKey);
  return bootstrapKeyPath(rootDir, envName);
}

export function mergeServerKeys(
  rootDir: string,
  servers: Record<string, any>,
): Record<string, any> {
  return Object.fromEntries(
    Object.entries(servers).map(([name, server]) => [
      name,
      {
        ...server,
        key: resolveServerKey(rootDir, name, server.key),
      },
    ]),
  );
}

/** Move committed key paths into deployment.local.json and clear them from the shared config. */
export function migrateKeysFromMainConfig(rootDir: string): boolean {
  const configPath = path.join(rootDir, "deployment.config.json");
  if (!fs.existsSync(configPath)) return false;

  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  let configChanged = false;
  let localChanged = false;
  const local = readLocalConfig(rootDir);
  if (!local.sshKeys) local.sshKeys = {};

  for (const [name, server] of Object.entries(raw.servers || {}) as [
    string,
    any,
  ][]) {
    const key = server.key?.trim();
    if (!key) continue;

    if (!local.sshKeys[name]) {
      const resolved = resolveKeyPath(rootDir, key);
      if (resolved) {
        local.sshKeys[name] = resolved;
        localChanged = true;
      }
    }

    raw.servers[name].key = "";
    configChanged = true;
  }

  if (localChanged) writeLocalConfig(rootDir, local);
  if (configChanged) {
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2));
  }
  return configChanged || localChanged;
}
