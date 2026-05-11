import path from "node:path";
import { determineCleanupPlan } from "./retentionManager";
import logger from "../utils/logger";
import { runSsh, spawnSsh, shSingleQuote } from "../utils/ssh";

function formatBytes(size: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(2)} ${units[unit]}`;
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

function getBackupRoot(server: any): string {
  return server.backupRoot || `${server.basePath}/.deployment_backups`;
}

export async function createBackup({
  rootDir,
  config,
  envName,
  deploymentVersion,
  sourcePathOverride,
  label,
}: {
  rootDir: string;
  config: any;
  envName: string;
  deploymentVersion: string;
  sourcePathOverride?: string | null;
  label?: string;
}) {
  const server = serverForEnv(rootDir, config, envName);
  const targetPath = sourcePathOverride || server.basePath;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const checkResult = await runSsh(
    server,
    `[ -d ${shSingleQuote(targetPath)} ] && echo "exists" || echo "missing"`,
  );

  let finalBackupPath = `${targetPath}_${day}${month}Bkp-${year}`;

  if (checkResult.stdout.trim() === "exists") {
    const displayLabel = label ? `${label} ` : "";
    logger.info(`${displayLabel}Backup Available`);

    // Find unique backup path
    let suffix = 0;
    while (true) {
      const bkpExists = await runSsh(
        server,
        `[ -d ${shSingleQuote(finalBackupPath)} ] && echo "exists" || echo "missing"`,
      );
      if (bkpExists.stdout.trim() === "missing") break;
      suffix++;
      finalBackupPath = `${targetPath}_${day}${month}Bkp${suffix}-${year}`;
    }

    logger.info(`Taking ${displayLabel}Backup ....`);
    // Rename existing folder
    await runSsh(
      server,
      `mv ${shSingleQuote(targetPath)} ${shSingleQuote(finalBackupPath)}`,
    );
    logger.info(`${displayLabel}Backup Completed`);
  }

  return {
    path: finalBackupPath,
    timestamp: new Date().toISOString(),
    environment: envName,
    deploymentVersion: deploymentVersion || "unknown",
    deploymentStatus: "successful",
  };
}

export async function listBackups({
  rootDir,
  config,
  envName,
}: {
  rootDir: string;
  config: any;
  envName: string;
}) {
  const server = serverForEnv(rootDir, config, envName);
  const envBackupsRoot = getBackupRoot(server);
  const listScript = `
    for folder in $(find ${shSingleQuote(envBackupsRoot)} -maxdepth 1 -type d -iname "*bkp*"); do
      basename_folder=$(basename "$folder")
      size=$(du -sb "$folder" 2>/dev/null | awk '{print $1}')
      mtime=$(stat -c '%y' "$folder" 2>/dev/null | cut -d'.' -f1 | tr ' ' 'T')
      meta=$(cat "$folder/backup.meta.json" 2>/dev/null || echo "")
      echo "START_BKP_RECORD"
      echo "$basename_folder"
      echo "$size"
      echo "$mtime"
      echo "$meta"
      echo "END_BKP_RECORD"
    done
  `;

  const listResult = await runSsh(server, listScript);
  const lines = listResult.stdout ? listResult.stdout.split("\n") : [];
  
  const backups = [];
  let currentRecord: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "START_BKP_RECORD") {
      currentRecord = { metaLines: [] };
    } else if (line === "END_BKP_RECORD" && currentRecord) {
      try {
        const folderName = currentRecord.basename;
        const backupPath = `${envBackupsRoot}/${folderName}`;
        const sizeBytes = Number.parseInt(currentRecord.size, 10) || 0;
        const mtime = currentRecord.mtime ? `${currentRecord.mtime}Z` : new Date().toISOString();
        
        let metadata = null;
        const metaStr = currentRecord.metaLines.join("").trim();
        if (metaStr) {
          try { metadata = JSON.parse(metaStr); } catch (e) {}
        }

        const resolvedTimestamp = metadata?.timestamp || mtime;

        backups.push({
          name: folderName,
          path: backupPath,
          timestamp: resolvedTimestamp,
          environment: metadata?.environment || envName,
          deploymentVersion: metadata?.deploymentVersion || "unknown",
          deploymentStatus: metadata?.deploymentStatus || "unknown",
          backupSizeBytes: sizeBytes,
          backupSizeHuman: formatBytes(sizeBytes),
          createdAt: mtime,
        });
      } catch (err) {
        // ignore malformed record
      }
      currentRecord = null;
    } else if (currentRecord) {
      if (!currentRecord.basename) currentRecord.basename = line;
      else if (!currentRecord.size) currentRecord.size = line;
      else if (!currentRecord.mtime) currentRecord.mtime = line;
      else currentRecord.metaLines.push(lines[i]); // Keep original formatting for JSON
    }
  }

  backups.sort(
    (a: any, b: any) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return backups;
}

export async function streamBackups({
  rootDir,
  config,
  envName,
  onBackup,
}: {
  rootDir: string;
  config: any;
  envName: string;
  onBackup: (backup: any) => void;
}) {
  const server = serverForEnv(rootDir, config, envName);
  const envBackupsRoot = getBackupRoot(server);
  const listScript = `
    for folder in $(find ${shSingleQuote(envBackupsRoot)} -maxdepth 1 -type d -iname "*bkp*"); do
      basename_folder=$(basename "$folder")
      size=$(du -sb "$folder" 2>/dev/null | awk '{print $1}')
      mtime=$(stat -c '%y' "$folder" 2>/dev/null | cut -d'.' -f1 | tr ' ' 'T')
      meta=$(cat "$folder/backup.meta.json" 2>/dev/null || echo "")
      echo "START_BKP_RECORD"
      echo "$basename_folder"
      echo "$size"
      echo "$mtime"
      echo "$meta"
      echo "END_BKP_RECORD"
    done
  `;

  let currentRecord: any = null;

  await spawnSsh(
    server,
    listScript,
    (line) => {
      line = line.trim();
      if (line === "START_BKP_RECORD") {
        currentRecord = { metaLines: [] };
      } else if (line === "END_BKP_RECORD" && currentRecord) {
        try {
          const folderName = currentRecord.basename;
          const backupPath = `${envBackupsRoot}/${folderName}`;
          const sizeBytes = Number.parseInt(currentRecord.size, 10) || 0;
          const mtime = currentRecord.mtime ? `${currentRecord.mtime}Z` : new Date().toISOString();
          
          let metadata = null;
          const metaStr = currentRecord.metaLines.join("").trim();
          if (metaStr) {
            try { metadata = JSON.parse(metaStr); } catch (e) {}
          }

          const resolvedTimestamp = metadata?.timestamp || mtime;

          onBackup({
            name: folderName,
            path: backupPath,
            timestamp: resolvedTimestamp,
            environment: metadata?.environment || envName,
            deploymentVersion: metadata?.deploymentVersion || "unknown",
            deploymentStatus: metadata?.deploymentStatus || "unknown",
            backupSizeBytes: sizeBytes,
            backupSizeHuman: formatBytes(sizeBytes),
            createdAt: mtime,
          });
        } catch (err) {
          // ignore malformed record
        }
        currentRecord = null;
      } else if (currentRecord) {
        if (!currentRecord.basename) currentRecord.basename = line;
        else if (!currentRecord.size) currentRecord.size = line;
        else if (!currentRecord.mtime) currentRecord.mtime = line;
        else currentRecord.metaLines.push(line);
      }
    },
    (errLine) => {
      logger.warn(`SSH Stream Error: ${errLine}`);
    }
  );
}

export function findLatestSuccessfulBackup(backups: any[]) {
  return (
    backups.find((backup) => backup.deploymentStatus === "successful") || null
  );
}

export async function cleanupBackups({
  rootDir,
  config,
  envName,
  retentionCount,
  dryRun = false,
  force = false,
}: {
  rootDir: string;
  config: any;
  envName: string;
  retentionCount: number;
  dryRun?: boolean;
  force?: boolean;
}) {
  const backups = await listBackups({ rootDir, config, envName });
  if (!backups.length) {
    logger.warn(`No backups available for ${envName}. Nothing to cleanup.`);
    return {
      envName,
      retentionCount,
      deleted: [],
      retained: [],
      latestSuccessful: null,
      dryRun,
    };
  }

  if (backups.length <= retentionCount) {
    return {
      envName,
      retentionCount,
      deleted: [],
      retained: backups,
      latestSuccessful: findLatestSuccessfulBackup(backups),
      dryRun,
    };
  }

  const latestSuccessful = findLatestSuccessfulBackup(backups);
  const plan = determineCleanupPlan({
    backups,
    retentionCount,
    latestSuccessfulBackupPath: latestSuccessful?.path || null,
  });

  if (!force && !dryRun) {
    throw new Error(
      `Cleanup aborted for ${envName}. Use --force to allow deletion or --dry-run to preview.`,
    );
  }

  if (dryRun) {
    return {
      envName,
      retentionCount,
      deleted: [],
      retained: plan.retained,
      latestSuccessful,
      dryRun: true,
      plannedDeletion: plan.deletable,
    };
  }

  for (const backup of plan.deletable) {
    logger.warn(
      `Deleting old backup ${backup.name} (${backup.backupSizeHuman}) from ${backup.timestamp}`,
    );
    const server = serverForEnv(rootDir, config, envName);
    await runSsh(server, `rm -rf ${shSingleQuote(backup.path)}`);
  }

  return {
    envName,
    retentionCount,
    deleted: plan.deletable,
    retained: plan.retained,
    latestSuccessful,
    dryRun: false,
  };
}
