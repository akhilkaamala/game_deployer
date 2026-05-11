import { cleanupBackups, listBackups } from "../backup/backupManager";
import { resolveRetentionCount } from "../backup/retentionManager";
import logger from "../utils/logger";

export async function runPostDeploymentCleanup({
  rootDir,
  config,
  envName,
  deploymentStatus,
  cliRetain,
  dryRun = false,
}: {
  rootDir: string;
  config: any;
  envName: string;
  deploymentStatus: string;
  cliRetain: number | null;
  dryRun?: boolean;
}) {
  if (deploymentStatus !== "success") {
    logger.warn(`Skipping cleanup for ${envName}: deployment not successful.`);
    return null;
  }

  const retentionCount = resolveRetentionCount({ config, envName, cliRetain });
  const cleanupReport = await cleanupBackups({
    rootDir,
    config,
    envName,
    retentionCount,
    dryRun,
    force: true,
  });

  const currentBackups = await listBackups({ rootDir, config, envName });
  return {
    ...cleanupReport,
    retainedBackupsCount: currentBackups.length,
  };
}
