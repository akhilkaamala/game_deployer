const path = require("node:path");
const fs = require("node:fs");
const { createBackup } = require("../backup/backupManager");
const { pathExists, toAbsolutePath } = require("../utils/fileSystem");
const {
  runSsh,
  runRsyncToRemote,
  runRemoteToRemoteRsync,
  shSingleQuote,
} = require("../utils/ssh");
const logger = require("../utils/logger");

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
  // Determine JSON relative path
  const rawJsonExt = mappedGameData?.jsonExt || ".json";
  const isPathPrefix = rawJsonExt.startsWith("/");
  const mappedJsonRelPath = isPathPrefix
    ? rawJsonExt
    : `${mappedGameFolder}${rawJsonExt}`;

  // Source Paths
  const sourcePath = mappedGameFolder
    ? path.posix.join(sourceServer.basePath, mappedGameFolder)
    : sourceServer.basePath;
  const sourceJsonPath =
    sourceServer.jsonRootPath && mappedGameFolder
      ? path.posix.join(
          sourceServer.jsonRootPath,
          mappedJsonRelPath.replace(/^\/+/, ""),
        )
      : null;

  // Target Paths
  const targetPath = mappedGameFolder
    ? path.posix.join(targetServer.basePath, mappedGameFolder)
    : targetServer.basePath;
  const targetJsonPath =
    targetServer.jsonRootPath && mappedGameFolder
      ? path.posix.join(
          targetServer.jsonRootPath,
          mappedJsonRelPath.replace(/^\/+/, ""),
        )
      : null;

  return {
    sourceServer,
    targetServer,
    sourcePath,
    sourceJsonPath,
    targetPath,
    targetJsonPath,
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

async function deployEnvironment({
  rootDir,
  config,
  sourceEnv,
  targetEnv,
  gamePath,
  skipGameBackup,
  skipJsonBackup,
  dryRun,
}: {
  rootDir: string;
  config: any;
  sourceEnv: string;
  targetEnv: string;
  gamePath?: string | null;
  skipGameBackup?: boolean;
  skipJsonBackup?: boolean;
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

  logger.info(`Connecting ${sourceEnv.toUpperCase()} Server...`);
  await runSsh(sourceServer, "echo 1");
  logger.info(`${sourceEnv.toUpperCase()} Connected`);

  logger.info(`Connecting ${targetEnv.toUpperCase()} Server...`);
  await runSsh(targetServer, "echo 1");
  logger.info(`${targetEnv.toUpperCase()} Connected`);

  // Ensure target base paths exist
  await runSsh(
    targetServer,
    `mkdir -p ${shSingleQuote(targetServer.basePath)}`,
  );
  if (paths.targetJsonPath) {
    await runSsh(
      targetServer,
      `mkdir -p ${shSingleQuote(path.posix.dirname(paths.targetJsonPath))}`,
    );
  }

  let backupCreated = null;

  // 1. Backup Game Folder
  if (!skipGameBackup) {
    backupCreated = await createBackup({
      rootDir,
      config,
      envName: targetEnv,
      deploymentVersion: version,
      sourcePathOverride: targetPath,
      label: "Game",
    });
  } else {
    logger.info(`Skipping Game backup as requested.`);
  }

  // 2. Backup JSON Folder
  if (!skipJsonBackup && paths.targetJsonPath) {
    await createBackup({
      rootDir,
      config,
      envName: targetEnv,
      deploymentVersion: version,
      sourcePathOverride: paths.targetJsonPath,
      label: "JSON",
    });
  } else if (!paths.targetJsonPath) {
    // skip silently or log info
  } else {
    logger.info(`Skipping JSON backup as requested.`);
  }

  logger.info(
    `${dryRun ? "[DRY RUN] " : ""}Syncing from ${sourceEnv.toUpperCase()} to ${targetEnv.toUpperCase()}...`,
  );
  await runRemoteToRemoteRsync(
    sourceServer,
    targetServer,
    sourcePath,
    targetPath,
    dryRun,
  );
  logger.info(`${dryRun ? "[DRY RUN] " : ""}Syncing Completed`);

  if (paths.sourceJsonPath && paths.targetJsonPath) {
    logger.info(`${dryRun ? "[DRY RUN] " : ""}Syncing JSON Files`);
    await runRemoteToRemoteRsync(
      sourceServer,
      targetServer,
      paths.sourceJsonPath,
      paths.targetJsonPath,
      dryRun,
    );
    logger.info(`${dryRun ? "[DRY RUN] " : ""}Synced Json files`);
  }

  if (dryRun) {
    logger.info(`[DRY RUN] Skipping CloudFront invalidation.`);
    return {
      status: "success",
      dryRun: true,
      message: "Dry run completed successfully. No changes were made.",
    };
  }

  await runSsh(targetServer, `test -d ${shSingleQuote(targetPath)}`);

  logger.info(`Invalidating ${targetEnv.toUpperCase()}`);
  const cloudfront = await runCloudFrontInvalidationIfConfigured(
    targetServer,
    targetEnv,
  );
  logger.info(`Invalidating Completed`);

  const report = {
    environment: targetEnv,
    deploymentVersion: version,
    sourcePath: sourcePath,
    targetPath,
    targetJsonPath: paths.targetJsonPath,
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

module.exports = {
  deployEnvironment,
};
