export function resolveRetentionCount({
  config,
  envName,
  cliRetain,
}: {
  config: any;
  envName: string;
  cliRetain: number | null;
}): number {
  if (Number.isInteger(cliRetain) && (cliRetain as number) > 0) {
    return cliRetain as number;
  }
  return config.backupRetention[envName] ?? 5;
}

function sortNewestFirst(backups: any[]): any[] {
  return [...backups].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function determineCleanupPlan({
  backups,
  retentionCount,
  latestSuccessfulBackupPath,
}: {
  backups: any[];
  retentionCount: number;
  latestSuccessfulBackupPath: string | null;
}) {
  const sorted = sortNewestFirst(backups);
  const retained = sorted.slice(0, retentionCount);
  const deleteCandidates = sorted.slice(retentionCount);

  const deletable = deleteCandidates.filter((backup) => backup.path !== latestSuccessfulBackupPath);
  const protectedBackup = deleteCandidates.find((backup) => backup.path === latestSuccessfulBackupPath);

  return {
    retained,
    deletable,
    protectedBackup,
  };
}
