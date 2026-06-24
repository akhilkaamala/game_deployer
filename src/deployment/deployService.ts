import path from "node:path";
import fs from "node:fs";
import { createBackup } from "../backup/backupManager";
import { pathExists, toAbsolutePath } from "../utils/fileSystem";
import {
  runSsh,
  runRsyncToRemote,
  runRemoteToRemoteRsync,
  shSingleQuote,
} from "../utils/ssh";
import logger from "../utils/logger";

function deploymentVersion(): string {
  return `v${new Date().toISOString()}`;
}

function serverForEnv(rootDir: string, config: any, envName: string) {
  const server = config.servers?.[envName];
  if (!server) {
    throw new Error(`Missing server config for ${envName}`);
  }
  return {
    ...server,
    key: path.resolve(rootDir, server.key),
  };
}

function sanitizeRelativePath(inputPath: string): string {
  return String(inputPath || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function resolvePaths({
  rootDir,
  config,
  sourceEnv,
  targetEnv,
  gamePath,
}: {
  rootDir: string;
  config: any;
  sourceEnv: string;
  targetEnv: string;
  gamePath?: string | null;
}) {
  const sourceServer = config.servers[sourceEnv];
  const targetServer = config.servers[targetEnv];

  if (!sourceServer)
    throw new Error(`Source server ${sourceEnv} not found in config`);
  if (!targetServer)
    throw new Error(`Target server ${targetEnv} not found in config`);

  // Normalized game name and folder
  const normalizedGameName = gamePath ? sanitizeRelativePath(gamePath) : null;
  const mappedGameData = normalizedGameName
    ? config.gameFolderMap?.[normalizedGameName]
    : null;
  const mappedGameFolder = mappedGameData
    ? typeof mappedGameData === "string"
      ? mappedGameData
      : mappedGameData.path
    : normalizedGameName;

  // Source Paths
  const sourcePath = mappedGameFolder
    ? path.posix.join(sourceServer.basePath, mappedGameFolder)
    : sourceServer.basePath;

  // Target Paths
  const targetPath = mappedGameFolder
    ? path.posix.join(targetServer.basePath, mappedGameFolder)
    : targetServer.basePath;

  return {
    sourceServer,
    targetServer,
    sourcePath,
    targetPath,
    gamePath: mappedGameFolder,
  };
}

async function validateDeploymentPaths(
  sourcePath: string,
  server: any,
): Promise<void> {
  if (!(await pathExists(sourcePath))) {
    throw new Error(`Source path not found: ${sourcePath}`);
  }
  if (!fs.existsSync(server.key)) {
    throw new Error(`SSH key not found: ${server.key}`);
  }
  await runSsh(server, `mkdir -p ${shSingleQuote(server.basePath)}`);
}

async function runCloudFrontInvalidationIfConfigured(
  server: any,
  envName: string,
) {
  const distributionId = server.cloudfrontDistribution;
  if (!distributionId) {
    logger.info(
      `CloudFront invalidation skipped for ${envName}: distribution not configured.`,
    );
    return {
      attempted: false,
      status: "skipped",
      reason: "distribution_not_configured",
    };
  }
  if (!fs.existsSync(server.key)) {
    logger.warn(
      `CloudFront invalidation skipped for ${envName}: key not found at ${server.key}.`,
    );
    return { attempted: false, status: "skipped", reason: "key_missing" };
  }

  try {
    logger.info(
      `Starting CloudFront invalidation for ${envName} (${distributionId}) on ${server.host}.`,
    );
    const result = await runSsh(
      server,
      `aws cloudfront create-invalidation --distribution-id ${shSingleQuote(distributionId)} --paths '/*'`,
    );
    logger.info(`CloudFront invalidation completed for ${envName}.`);
    return {
      attempted: true,
      status: "success",
      distributionId,
      output: result.stdout || null,
    };
  } catch (error: any) {
    logger.warn(
      `CloudFront invalidation failed for ${envName}, deployment remains successful: ${error.message}`,
    );
    return {
      attempted: true,
      status: "failed",
      distributionId,
      error: error.message,
    };
  }
}

export async function deployEnvironment({
  rootDir,
  config,
  sourceEnv,
  targetEnv,
  gamePath,
  skipGameBackup,
  dryRun,
}: {
  rootDir: string;
  config: any;
  sourceEnv: string;
  targetEnv: string;
  gamePath?: string | null;
  skipGameBackup?: boolean;
  dryRun?: boolean;
}) {
  logger.info(`Deploying ${gamePath || "Core Files"}`);
  const paths = resolvePaths({
    rootDir,
    config,
    sourceEnv,
    targetEnv,
    gamePath,
  });
  const { sourceServer, targetServer, targetPath, sourcePath } = paths;
  const version = deploymentVersion();

  if (!fs.existsSync(targetServer.key)) {
    throw new Error(`Target SSH key not found locally: ${targetServer.key}`);
  }
  if (!fs.existsSync(sourceServer.key)) {
    throw new Error(`Source SSH key not found locally: ${sourceServer.key}`);
  }

  const displayName = gamePath === "content" ? "CONTENT" : gamePath || "CORE";

  logger.info(
    `Connecting ${sourceEnv.toUpperCase()} Server for ${displayName}...`,
  );
  await runSsh(sourceServer, "echo 1");
  logger.info(`${sourceEnv.toUpperCase()} Connected for ${displayName}`);

  logger.info(
    `Connecting ${targetEnv.toUpperCase()} Server for ${displayName}...`,
  );
  await runSsh(targetServer, "echo 1");
  logger.info(`${targetEnv.toUpperCase()} Connected for ${displayName}`);

  // Ensure target base paths exist
  await runSsh(
    targetServer,
    `mkdir -p ${shSingleQuote(targetServer.basePath)}`,
  );
  // Ensure target base paths exist
  await runSsh(
    targetServer,
    `mkdir -p ${shSingleQuote(targetServer.basePath)}`,
  );

  let backupCreated = null;

  // 1. Backup Folder
  const displayLabel = gamePath === "content" ? "Content" : "Game";
  if (!skipGameBackup) {
    backupCreated = await createBackup({
      rootDir,
      config,
      envName: targetEnv,
      deploymentVersion: version,
      sourcePathOverride: targetPath,
      label: `${displayName} ${displayLabel}`,
    });
  } else {
    logger.info(`Skipping ${displayLabel} backup as requested.`);
  }

  logger.info(
    `${dryRun ? "[DRY RUN] " : ""}Syncing ${displayName} from ${sourceEnv.toUpperCase()} to ${targetEnv.toUpperCase()}...`,
  );

  let lastLoggedPercent = -1;
  let lastProgressAt = Date.now();
  let currentPhase: "pull" | "push" | null = null;
  const stallHeartbeat = setInterval(() => {
    if (
      lastLoggedPercent >= 90 &&
      Date.now() - lastProgressAt > 30_000 &&
      currentPhase
    ) {
      const phaseLabel =
        currentPhase === "pull" ? "pull from source" : "push to target";
      logger.info(
        `${displayName}: still ${phaseLabel} at ${lastLoggedPercent}% — rsync may pause near the end while deleting obsolete files`,
      );
      lastProgressAt = Date.now();
    }
  }, 30_000);

  try {
    await runRemoteToRemoteRsync(
      sourceServer,
      targetServer,
      sourcePath,
      targetPath,
      dryRun,
      (percent, phase) => {
        currentPhase = phase;
        lastProgressAt = Date.now();
        if (percent === lastLoggedPercent) return;
        lastLoggedPercent = percent;
        const phaseTag = phase === "pull" ? "pull" : "push";
        logger.info(`[PROGRESS] ${displayName} ${percent}% (${phaseTag})`);
      },
    );
  } finally {
    clearInterval(stallHeartbeat);
  }

  logger.info(
    `${dryRun ? "[DRY RUN] " : ""}Syncing Completed for ${displayName}`,
  );

  if (dryRun) {
    logger.info(`[DRY RUN] Skipping CloudFront invalidation.`);
    return {
      status: "success",
      dryRun: true,
      message: "Dry run completed successfully. No changes were made.",
    };
  }

  await runSsh(targetServer, `test -d ${shSingleQuote(targetPath)}`);

  logger.info(`Verifying deployment paths for ${displayName}`);
  logger.info(`Invalidating ${targetEnv.toUpperCase()} for ${displayName}`);
  logger.info(
    `Invalidating CloudFront cache for ${displayName} (this can take a few minutes)`,
  );
  const cloudfront = await runCloudFrontInvalidationIfConfigured(
    targetServer,
    targetEnv,
  );
  logger.info(`Invalidating Completed for ${displayName}`);
  logger.info(`[PROGRESS] ${displayName} 100% (done)`);

  const report = {
    environment: targetEnv,
    deploymentVersion: version,
    sourcePath: sourcePath,
    targetPath,
    gamePath: paths.gamePath,
    status: "success",
    host: targetServer.host,
    cloudfront,
    backupCreated,
    rollbackPointsAvailable: 1,
    deployedAt: new Date().toISOString(),
    artifacts: path.basename(sourcePath),
    syncType: "remote-to-remote",
  };

  logger.info(`Deployment successful for ${targetEnv}.`);
  return report;
}
