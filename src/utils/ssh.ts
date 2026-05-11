const { execFile, spawn } = require("node:child_process");

// Global set to track active child processes
const activeProcesses = new Set<any>();

function execFilePromise(
  cmd: string,
  args: string[],
  options: any,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, options, (error, stdout, stderr) => {
      activeProcesses.delete(child);
      if (error) {
        // If it was killed, return a more helpful error
        if (child.killed) {
          return reject(new Error("Process was manually terminated."));
        }
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
    activeProcesses.add(child);
  });
}

function killActiveProcesses() {
  const count = activeProcesses.size;
  for (const child of activeProcesses) {
    try {
      child.kill("SIGTERM");
    } catch (e) {
      // ignore
    }
  }
  activeProcesses.clear();
  return count;
}

type ServerConfig = {
  user: string;
  host: string;
  port?: number | null;
  key: string;
};

function toPortArgs(port?: number | null): string[] {
  if (!port) return [];
  return ["-p", String(port)];
}

function sshTarget(server: ServerConfig): string {
  return `${server.user}@${server.host}`;
}

async function runSsh(
  server: ServerConfig,
  command: string,
): Promise<{ stdout: string; stderr: string }> {
  const args = [
    "-i",
    server.key,
    "-o",
    "StrictHostKeyChecking=no",
    ...toPortArgs(server.port),
    sshTarget(server),
    command,
  ];
  const { stdout, stderr } = await execFilePromise("ssh", args, {
    maxBuffer: 1024 * 1024 * 10,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

function spawnSsh(
  server: ServerConfig,
  command: string,
  onLine: (line: string) => void,
  onError: (errLine: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-i",
      server.key,
      "-o",
      "StrictHostKeyChecking=no",
      ...toPortArgs(server.port),
      sshTarget(server),
      command,
    ];
    
    const child = spawn("ssh", args);
    activeProcesses.add(child);

    let stdoutBuf = "";
    let stderrBuf = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() || "";
      for (const line of lines) onLine(line);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
      const lines = stderrBuf.split("\n");
      stderrBuf = lines.pop() || "";
      for (const line of lines) onError(line);
    });

    child.on("close", (code) => {
      activeProcesses.delete(child);
      if (stdoutBuf) onLine(stdoutBuf);
      if (stderrBuf) onError(stderrBuf);
      
      if (code !== 0 && code !== null) {
        reject(new Error("SSH process exited with code " + code));
      } else {
        resolve();
      }
    });

    child.on("error", (err) => {
      activeProcesses.delete(child);
      reject(err);
    });
  });
}

async function runRsyncToRemote(
  server: ServerConfig,
  localPath: string,
  remotePath: string,
): Promise<{ stdout: string; stderr: string }> {
  const args = [
    "-az",
    "--no-t",
    "--delete",
    "-e",
    `ssh -i "${server.key}" -o StrictHostKeyChecking=no${server.port ? ` -p ${server.port}` : ""}`,
    `${localPath}/`,
    `${sshTarget(server)}:${remotePath}/`,
  ];
  const { stdout, stderr } = await execFilePromise("rsync", args, {
    maxBuffer: 1024 * 1024 * 10,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

function shSingleQuote(value: unknown): string {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

async function runScpToRemote(
  server: ServerConfig,
  localFilePath: string,
  remoteFilePath: string,
): Promise<{ stdout: string; stderr: string }> {
  const args = [
    "-i",
    server.key,
    "-o",
    "StrictHostKeyChecking=no",
    ...(server.port ? ["-P", String(server.port)] : []),
    localFilePath,
    `${sshTarget(server)}:${remoteFilePath}`,
  ];
  const { stdout, stderr } = await execFilePromise("scp", args, {
    maxBuffer: 1024 * 1024 * 10,
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

async function runRemoteToRemoteRsync(
  sourceServer: ServerConfig,
  targetServer: ServerConfig,
  sourcePath: string,
  targetPath: string,
  dryRun: boolean = false,
): Promise<{ stdout: string; stderr: string }> {
  const os = require("node:os");
  const path = require("node:path");
  const fs = require("node:fs");
  const tempLocalDir = path.join(os.tmpdir(), `deploy_${Date.now()}`);

  try {
    await fs.promises.mkdir(tempLocalDir, { recursive: true });

    // 1. Pull from source to local temp (Always real pull to get source state for comparison)
    const pullArgs = [
      "-az",
      "--delete",
      "-e",
      `ssh -i "${sourceServer.key}" -o StrictHostKeyChecking=no${sourceServer.port ? ` -p ${sourceServer.port}` : ""}`,
      `${sshTarget(sourceServer)}:${sourcePath}/`,
      `${tempLocalDir}/`,
    ];
    await execFilePromise("rsync", pullArgs, { maxBuffer: 1024 * 1024 * 10 });

    // 2. Push from local temp to target (Simulated if dryRun is true)
    const pushArgs = [
      "-az",
      "--no-t",
      "--delete",
      dryRun ? "-n" : null,
      "-e",
      `ssh -i "${targetServer.key}" -o StrictHostKeyChecking=no${targetServer.port ? ` -p ${targetServer.port}` : ""}`,
      `${tempLocalDir}/`,
      `${sshTarget(targetServer)}:${targetPath}/`,
    ].filter(Boolean) as string[];

    const result = await execFilePromise("rsync", pushArgs, {
      maxBuffer: 1024 * 1024 * 10,
    });
    return result;
  } finally {
    await fs.promises
    .rm(tempLocalDir, { recursive: true, force: true })
    .catch(() => {});
  }
}

module.exports = {
  runSsh,
  spawnSsh,
  runRsyncToRemote,
  runRemoteToRemoteRsync,
  shSingleQuote,
  killActiveProcesses,
};
