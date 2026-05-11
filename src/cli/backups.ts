#!/usr/bin/env node
const path = require("node:path");
const { parseArgs, normalizeEnv } = require("./args");
const { loadConfig, SUPPORTED_ENVS } = require("../config/loadConfig");
const { listBackups } = require("../backup/backupManager");
const logger = require("../utils/logger");

async function listForEnvironment(rootDir: string, config: any, envName: string) {
  const backups = await listBackups({ rootDir, config, envName });
  const latest = backups[0] || null;
  return {
    environment: envName,
    latestBackup: latest ? latest.name : null,
    count: backups.length,
    backups: backups.map((backup: any) => ({
      name: backup.name,
      size: backup.backupSizeHuman,
      timestamp: backup.timestamp,
      version: backup.deploymentVersion,
      status: backup.deploymentStatus,
    })),
  };
}

async function main(): Promise<void> {
  const argv = parseArgs(process.argv.slice(2));
  const envName = normalizeEnv(argv.env);
  const rootDir = path.resolve(__dirname, "..", "..");
  const config = loadConfig({ rootDir, cliRetain: null });
  const environments = envName && envName !== "all" ? [envName] : SUPPORTED_ENVS;

  for (const item of environments) {
    if (!SUPPORTED_ENVS.includes(item)) {
      throw new Error(`Invalid --env '${item}'. Supported: qa, preprod, all`);
    }
  }

  const reports = [];
  for (const environment of environments) {
    reports.push(await listForEnvironment(rootDir, config, environment));
  }

  logger.info("Available backups:");
  console.log(JSON.stringify(reports, null, 2));
}

main().catch((error: any) => {
  logger.error(error.message);
  process.exit(1);
});

