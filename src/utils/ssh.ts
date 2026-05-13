import { execFile, spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

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
        resolve({
          stdout: typeof stdout === "string" ? stdout : stdout.toString(),
          stderr: typeof stderr === "string" ? stderr : stderr.toString(),
        });
      }
    });
    activeProcesses.add(child);
  });
}

export function killActiveProcesses() {
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

export async function runSsh(
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

export function spawnSsh(
  server: ServerConfig,
  command: string,
  onLine: (line: string) => void,
  onError: (errLine: string) => void,
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

    child.stdout.on("data", (chunk: any) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      stdoutBuf = lines.pop() || "";
      for (const line of lines) onLine(line);
    });

    child.stderr.on("data", (chunk: any) => {
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

export async function runRsyncToRemote(
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

export function shSingleQuote(value: unknown): string {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

export async function runScpToRemote(
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

export async function runRemoteToRemoteRsync(
  sourceServer: ServerConfig,
  targetServer: ServerConfig,
  sourcePath: string,
  targetPath: string,
  dryRun: boolean = false,
  onProgress?: (percent: number) => void,
): Promise<{ stdout: string; stderr: string }> {
  const tempLocalDir = path.join(os.tmpdir(), `deploy_${Date.now()}`);

  try {
    await fs.promises.mkdir(tempLocalDir, { recursive: true });

    // 1. Pull from source to local temp
    const pullArgs = [
      "-az",
      "--delete",
      "--info=progress2",
      "-e",
      `ssh -i "${sourceServer.key}" -o StrictHostKeyChecking=no${sourceServer.port ? ` -p ${sourceServer.port}` : ""}`,
      `${sshTarget(sourceServer)}:${sourcePath}/`,
      `${tempLocalDir}/`,
    ];

    let lastStdout = "";
    const pullResult = await new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = spawn("rsync", pullArgs);
        activeProcesses.add(child);
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (data) => {
          const chunk = data.toString();
          stdout += chunk;
          const match = chunk.match(/(\d+)%/);
          if (match && onProgress) {
            onProgress(Math.floor(Number.parseInt(match[1], 10) * 0.5));
          }
        });
        child.stderr.on("data", (data) => (stderr += data.toString()));
        child.on("close", (code) => {
          activeProcesses.delete(child);
          if (code === 0) resolve({ stdout, stderr });
          else reject(new Error(`Source pull failed with code ${code}: ${stderr}`));
        });
      },
    );

    // 2. Push from local temp to target
    const pushArgs = [
      "-az",
      "--no-t",
      "--delete",
      "--info=progress2",
      dryRun ? "-n" : null,
      "-e",
      `ssh -i "${targetServer.key}" -o StrictHostKeyChecking=no${targetServer.port ? ` -p ${targetServer.port}` : ""}`,
      `${tempLocalDir}/`,
      `${sshTarget(targetServer)}:${targetPath}/`,
    ].filter(Boolean) as string[];

    const pushResult = await new Promise<{ stdout: string; stderr: string }>(
      (resolve, reject) => {
        const child = spawn("rsync", pushArgs);
        activeProcesses.add(child);
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (data) => {
          const chunk = data.toString();
          stdout += chunk;
          const match = chunk.match(/(\d+)%/);
          if (match && onProgress) {
            onProgress(50 + Math.floor(Number.parseInt(match[1], 10) * 0.5));
          }
        });
        child.stderr.on("data", (data) => (stderr += data.toString()));
        child.on("close", (code) => {
          activeProcesses.delete(child);
          if (code === 0) resolve({ stdout, stderr });
          else reject(new Error(`Target push failed with code ${code}: ${stderr}`));
        });
      },
    );

    return {
      stdout: pullResult.stdout + pushResult.stdout,
      stderr: pullResult.stderr + pushResult.stderr,
    };
  } finally {
    await fs.promises
      .rm(tempLocalDir, { recursive: true, force: true })
      .catch(() => {});
  }
}
