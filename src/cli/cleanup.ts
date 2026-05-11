#!/usr/bin/env node
const path = require("node:path");
const { parseArgs, normalizeEnv, toInteger } = require("./args");
const { loadConfig, SUPPORTED_ENVS } = require("../config/loadConfig");
const { cleanupBackups } = require("../backup/backupManager");
const { resolveRetentionCount } = require("../backup/retentionManager");
const logger = require("../utils/logger");

async function main(): Promise<void> {
  const argv = parseArgs(process.argv.slice(2));
  const envName = normalizeEnv(argv.env);
  const cliRetain = toInteger(argv.retain);
  const dryRun = Boolean(argv["dry-run"]);
  const force = Boolean(argv.force);
  const rootDir = path.resolve(__dirname, "..", "..");
  const config = loadConfig({ rootDir, cliRetain });
  const environments = envName && envName !== "all" ? [envName] : SUPPORTED_ENVS;

  for (const item of environments) {
    if (!SUPPORTED_ENVS.includes(item)) {
      throw new Error(`Invalid --env '${item}'. Supported: qa, preprod, all`);
    }
  }

  const results = [];
  for (const environment of environments) {
    const retentionCount = resolveRetentionCount({ config, envName: environment, cliRetain });
    const result = await cleanupBackups({
      rootDir,
      config,
      envName: environment,
      retentionCount,
      dryRun,
      force,
    });
    results.push(result);
  }

  logger.info("Cleanup completed.");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error: any) => {
  logger.error(error.message);
  process.exit(1);
});

