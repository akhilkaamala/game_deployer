#!/usr/bin/env node
const path = require("node:path");
const { parseArgs, normalizeEnv, toInteger } = require("./args");
const { loadConfig, SUPPORTED_ENVS } = require("../config/loadConfig");
const { deployEnvironment } = require("../deployment/deployService");
const { runPostDeploymentCleanup } = require("../deployment/cleanupScheduler");
const logger = require("../utils/logger");

async function main(): Promise<void> {
  const argv = parseArgs(process.argv.slice(2));
  const envName = normalizeEnv(argv.env);
  const cliRetain = toInteger(argv.retain);
  const dryRun = Boolean(argv["dry-run"]);
  const gamePath = argv.game ? String(argv.game).trim() : null;
  const sourcePath = argv.source ? String(argv.source).trim() : null;

  if (!envName || !SUPPORTED_ENVS.includes(envName)) {
    throw new Error(`Invalid --env. Supported values: ${SUPPORTED_ENVS.join(", ")}`);
  }

  const rootDir = path.resolve(__dirname, "..", "..");
  const config = loadConfig({ rootDir, cliRetain });
  const deploymentReport = await deployEnvironment({ rootDir, config, envName, gamePath, sourcePath });
  const cleanupReport = await runPostDeploymentCleanup({
    rootDir,
    config,
    envName,
    deploymentStatus: deploymentReport.status,
    cliRetain,
    dryRun,
  });

  const report = {
    deployment: deploymentReport,
    cleanup: {
      backupCreated: deploymentReport.backupCreated?.name || deploymentReport.backupCreated?.path,
      backupsDeleted: cleanupReport?.deleted?.map((b: any) => b.name) || [],
      retainedBackupsCount: cleanupReport?.retainedBackupsCount || 0,
      rollbackPointsAvailable: cleanupReport?.retainedBackupsCount || 0,
      dryRun: Boolean(cleanupReport?.dryRun),
    },
  };

  logger.info("Deployment report:");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: any) => {
  logger.error(error.message);
  process.exit(1);
});

