import fs from "node:fs";
import { exec } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { loadConfig, SUPPORTED_ENVS } from "../config/loadConfig";
import { deployEnvironment } from "../deployment/deployService";
import { runPostDeploymentCleanup } from "../deployment/cleanupScheduler";
import { listBackups, streamBackups } from "../backup/backupManager";
import { runSsh, killActiveProcesses } from "../utils/ssh";
import logger, { logEmitter } from "../utils/logger";

// Determine the project root directory safely
let rootDir = process.cwd();
if (typeof __dirname !== "undefined") {
  rootDir = path.resolve(__dirname, "..", "..");
}

// Fallback check for config file to ensure we found the root
if (!fs.existsSync(path.join(rootDir, "deployment.config.json"))) {
  rootDir = process.cwd();
}

// Look for the UI in 'dist/web' or just 'web'
let reactDistDir = path.join(rootDir, "dist", "web");
if (!fs.existsSync(reactDistDir)) {
  reactDistDir = path.join(rootDir, "web");
}

// ── SSH Key Bootstrap ──────────────────────────────────────────────────────
// On cloud deployments (e.g. Render), SSH keys are not on disk.
// Store each key's content as an env var: SSH_KEY_<ENVNAME> (e.g. SSH_KEY_QA)
// On startup we write them to keys/<envname>.pem and update deployment.config.json
// to use the relative path so deployments work correctly.
(function bootstrapSshKeys() {
  const configPath = path.join(rootDir, "deployment.config.json");
  if (!fs.existsSync(configPath)) return;

  let config: any;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return;
  }

  const keysDir = path.join(rootDir, "keys");
  let configChanged = false;

  for (const [envName, server] of Object.entries(config.servers || {}) as [
    string,
    any,
  ][]) {
    const envVarName = `SSH_KEY_${envName.toUpperCase().replace(/-/g, "_")}`;
    const keyContent = process.env[envVarName];

    if (keyContent) {
      // Write the key from environment variable
      if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });
      const keyPath = path.join(keysDir, `${envName}.pem`);
      fs.writeFileSync(keyPath, keyContent.replace(/\\n/g, "\n"), {
        mode: 0o600,
      });
      // Update config to use the new relative path
      config.servers[envName].key = `./keys/${envName}.pem`;
      configChanged = true;
      console.log(
        `[bootstrap] Wrote SSH key for '${envName}' from env var ${envVarName}`,
      );
    } else if (server.key && !path.isAbsolute(server.key)) {
      // Already a relative path — resolve and check it exists
      const resolved = path.resolve(rootDir, server.key);
      if (!fs.existsSync(resolved)) {
        console.warn(
          `[bootstrap] Warning: key for '${envName}' not found at ${resolved}`,
        );
      }
    } else if (
      server.key &&
      path.isAbsolute(server.key) &&
      !fs.existsSync(server.key)
    ) {
      // Absolute path from local machine that doesn't exist here — try relative fallback
      const fallback = path.join(keysDir, `${envName}.pem`);
      if (fs.existsSync(fallback)) {
        config.servers[envName].key = `./keys/${envName}.pem`;
        configChanged = true;
        console.log(
          `[bootstrap] Remapped key for '${envName}' to relative fallback`,
        );
      } else {
        console.warn(
          `[bootstrap] Warning: no key available for '${envName}' — SSH will fail`,
        );
      }
    }
  }

  if (configChanged) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
})();
// ──────────────────────────────────────────────────────────────────────────

const port = Number.parseInt(
  process.env.PORT || process.env.UI_PORT || "4173",
  10,
);

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function parseBody(req: http.IncomingMessage): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk: any) => {
      raw += chunk.toString();
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function extractGameCatalog(config: any): string[] {
  const gameBase = config.paths?.sourcePath;
  if (!gameBase) return [];
  const absoluteBase = path.isAbsolute(gameBase)
    ? gameBase
    : path.resolve(rootDir, gameBase);
  if (!fs.existsSync(absoluteBase)) return [];
  const entries = fs.readdirSync(absoluteBase, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  return "text/html; charset=utf-8";
}

async function serveFile(
  res: http.ServerResponse,
  filePath: string,
): Promise<void> {
  const data = await fsp.readFile(filePath);
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  res.end(data);
}

async function saveHistory(rootDir: string, reports: any[]) {
  const historyPath = path.join(rootDir, "data", "history.json");
  let history = [];
  try {
    if (fs.existsSync(historyPath)) {
      history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
    }
  } catch (e) {
    history = [];
  }

  const newEntry = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    reports: Array.isArray(reports) ? reports : [reports],
    summary: {
      total: Array.isArray(reports) ? reports.length : 1,
      success: (Array.isArray(reports) ? reports : [reports]).filter(
        (r) => r.status === "success",
      ).length,
      failed: (Array.isArray(reports) ? reports : [reports]).filter(
        (r) => r.status !== "success",
      ).length,
    },
  };

  history.unshift(newEntry);
  if (history.length > 100) history = history.slice(0, 100);

  const dataDir = path.join(rootDir, "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const url = new URL(req.url || "", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { status: "ok", uptime: process.uptime() });
  }

  if (req.method === "GET" && url.pathname === "/api/browse-key") {
    if (process.platform !== "darwin") {
      return sendJson(res, 400, {
        error: "Native file picker only supported on macOS",
      });
    }
    const command = `osascript -e 'POSIX path of (choose file of type {"pem"} with prompt "Select your SSH Private Key (.pem)")'`;
    exec(command, (err, stdout) => {
      if (err) return sendJson(res, 200, { cancelled: true });
      const selectedPath = stdout.trim();
      return sendJson(res, 200, { path: selectedPath });
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/system-health") {
    const config = loadConfig({ rootDir, cliRetain: null });
    const mem = process.memoryUsage();
    const servers = config.servers || {};

    const SSH_TIMEOUT_MS = 6000;
    const envChecks = await Promise.all(
      Object.entries(servers).map(async ([name, srv]: [string, any]) => {
        const start = Date.now();
        try {
          await Promise.race([
            runSsh({ ...srv, key: srv.key }, "echo ok"),
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Connection timed out")),
                SSH_TIMEOUT_MS,
              ),
            ),
          ]);
          return { name, status: "online", latencyMs: Date.now() - start };
        } catch (e: any) {
          return {
            name,
            status: "offline",
            error: e.message?.split("\n")[0] || "Connection failed",
            latencyMs: Date.now() - start,
          };
        }
      }),
    );

    return sendJson(res, 200, {
      server: {
        uptime: process.uptime(),
        memoryMB: {
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          rss: Math.round(mem.rss / 1024 / 1024),
        },
        nodeVersion: process.version,
        platform: process.platform,
      },
      environments: envChecks,
      checkedAt: new Date().toISOString(),
    });
  }

  const configPath = path.join(rootDir, "deployment.config.json");

  if (req.method === "GET" && url.pathname === "/api/environments") {
    const config = loadConfig({ rootDir, cliRetain: null });
    return sendJson(res, 200, config.servers || {});
  }

  if (req.method === "POST" && url.pathname === "/api/environments") {
    const body = await parseBody(req);
    const { name, ...serverConfig } = body;
    if (!name)
      return sendJson(res, 400, { error: "Environment name is required" });
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (raw.servers[name])
      return sendJson(res, 409, {
        error: `Environment '${name}' already exists`,
      });
    raw.servers[name] = serverConfig;
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2));
    return sendJson(res, 201, {
      message: `Environment '${name}' created`,
      server: raw.servers[name],
    });
  }

  if (req.method === "POST" && url.pathname === "/api/environments/key") {
    const { name, keyContent } = await parseBody(req);
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const server = raw.servers[name];
    if (!server) return sendJson(res, 404, { error: "Environment not found" });

    let keyPath = server.key;
    if (!keyPath || keyPath.startsWith("./keys/")) {
      const keysDir = path.resolve(rootDir, "keys");
      if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });
      keyPath = path.join(keysDir, `${name}.pem`);
    } else if (!path.isAbsolute(keyPath)) {
      keyPath = path.resolve(rootDir, keyPath);
    }

    const dir = path.dirname(keyPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(keyPath, keyContent, { mode: 0o600 });

    if (!server.key) {
      server.key = `./keys/${name}.pem`;
      fs.writeFileSync(configPath, JSON.stringify(raw, null, 2));
    }

    logger.info(`SSH Key updated for environment: ${name}`);
    return sendJson(res, 200, {
      message: "Key saved successfully",
      path: keyPath,
    });
  }

  const envPutMatch = url.pathname.match(/^\/api\/environments\/([^/]+)$/);
  if (req.method === "PUT" && envPutMatch) {
    const envName = decodeURIComponent(envPutMatch[1]);
    const body = await parseBody(req);
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (!raw.servers[envName])
      return sendJson(res, 404, {
        error: `Environment '${envName}' not found`,
      });
    raw.servers[envName] = { ...raw.servers[envName], ...body };
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2));
    return sendJson(res, 200, {
      message: `Environment '${envName}' updated`,
      server: raw.servers[envName],
    });
  }

  if (req.method === "DELETE" && envPutMatch) {
    const envName = decodeURIComponent(envPutMatch[1]);
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (!raw.servers[envName])
      return sendJson(res, 404, {
        error: `Environment '${envName}' not found`,
      });
    delete raw.servers[envName];
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2));
    return sendJson(res, 200, { message: `Environment '${envName}' deleted` });
  }

  if (req.method === "GET" && url.pathname === "/api/games") {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return sendJson(res, 200, raw.gameFolderMap || {});
  }

  if (req.method === "POST" && url.pathname === "/api/games") {
    const body = await parseBody(req);
    const { name, path: gamePath, jsonExt } = body;
    if (!name || !gamePath || !jsonExt)
      return sendJson(res, 400, {
        error: "name, path, and jsonExt are required",
      });
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (!raw.gameFolderMap) raw.gameFolderMap = {};
    if (raw.gameFolderMap[name])
      return sendJson(res, 409, { error: `Game '${name}' already exists` });
    raw.gameFolderMap[name] = { path: gamePath, jsonExt };
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2));
    return sendJson(res, 201, {
      message: `Game '${name}' created`,
      game: raw.gameFolderMap[name],
    });
  }

  const gamePutMatch = url.pathname.match(/^\/api\/games\/(.+)$/);
  if (req.method === "PUT" && gamePutMatch) {
    const gameName = decodeURIComponent(gamePutMatch[1]);
    const body = await parseBody(req);
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (!raw.gameFolderMap?.[gameName])
      return sendJson(res, 404, { error: `Game '${gameName}' not found` });
    const { newName, path: gamePath, jsonExt } = body;
    if (newName && newName !== gameName) {
      raw.gameFolderMap[newName] = {
        path: gamePath || raw.gameFolderMap[gameName].path,
        jsonExt: jsonExt || raw.gameFolderMap[gameName].jsonExt,
      };
      delete raw.gameFolderMap[gameName];
    } else {
      raw.gameFolderMap[gameName] = {
        path: gamePath || raw.gameFolderMap[gameName].path,
        jsonExt: jsonExt || raw.gameFolderMap[gameName].jsonExt,
      };
    }
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2));
    return sendJson(res, 200, { message: `Game updated successfully` });
  }

  if (req.method === "DELETE" && gamePutMatch) {
    const gameName = decodeURIComponent(gamePutMatch[1]);
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (!raw.gameFolderMap?.[gameName])
      return sendJson(res, 404, { error: `Game '${gameName}' not found` });
    delete raw.gameFolderMap[gameName];
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2));
    return sendJson(res, 200, { message: `Game '${gameName}' deleted` });
  }

  if (req.method === "GET" && url.pathname === "/api/settings") {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return sendJson(res, 200, {
      backupRetention: raw.backupRetention || { qa: 3, preprod: 3 },
      sourcePath: raw.paths?.sourcePath || "",
      uiSettings: raw.uiSettings || {},
    });
  }

  if (req.method === "PUT" && url.pathname === "/api/settings") {
    const body = await parseBody(req);
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (body.backupRetention !== undefined)
      raw.backupRetention = { ...raw.backupRetention, ...body.backupRetention };
    if (body.sourcePath !== undefined) {
      if (!raw.paths) raw.paths = {};
      raw.paths.sourcePath = body.sourcePath;
    }
    if (body.uiSettings !== undefined)
      raw.uiSettings = { ...(raw.uiSettings || {}), ...body.uiSettings };
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2));
    return sendJson(res, 200, { message: "Settings saved" });
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    const config = loadConfig({ rootDir, cliRetain: null });
    return sendJson(res, 200, {
      environments: SUPPORTED_ENVS,
      retention: config.backupRetention,
      gameCatalog: extractGameCatalog(config),
      gameFolderMap: config.gameFolderMap || {},
      sourcePath: config.paths?.sourcePath || "",
      serverBasePaths: Object.fromEntries(
        Object.entries(config.servers).map(([name, s]: any) => [
          name,
          s.basePath,
        ]),
      ),
      jsonRootPaths: Object.fromEntries(
        Object.entries(config.servers).map(([name, s]: any) => [
          name,
          s.jsonRootPath,
        ]),
      ),
    });
  }

  if (req.method === "GET" && url.pathname === "/api/backups") {
    const envName = url.searchParams.get("env");
    if (!envName || !SUPPORTED_ENVS.includes(envName))
      return sendJson(res, 400, { error: "Invalid env." });
    const config = loadConfig({ rootDir, cliRetain: null });
    const backups = await listBackups({ rootDir, config, envName });
    return sendJson(res, 200, { env: envName, backups });
  }

  if (req.method === "GET" && url.pathname === "/api/backups/stream") {
    const envName = url.searchParams.get("env");
    if (!envName || !SUPPORTED_ENVS.includes(envName))
      return sendJson(res, 400, { error: "Invalid env." });
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    const config = loadConfig({ rootDir, cliRetain: null });
    try {
      await streamBackups({
        rootDir,
        config,
        envName,
        onBackup: (backup: any) =>
          res.write(`data: ${JSON.stringify(backup)}\n\n`),
      });
      res.write("event: end\ndata: {}\n\n");
    } catch (err: any) {
      res.write(
        `event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`,
      );
    } finally {
      res.end();
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/history") {
    const historyPath = path.join(rootDir, "data", "history.json");
    if (!fs.existsSync(historyPath)) return sendJson(res, 200, []);
    const history = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
    return sendJson(res, 200, history);
  }

  if (req.method === "DELETE" && url.pathname === "/api/history") {
    const historyPath = path.join(rootDir, "data", "history.json");
    if (fs.existsSync(historyPath)) fs.unlinkSync(historyPath);
    return sendJson(res, 200, { message: "History cleared" });
  }

  if (req.method === "DELETE" && url.pathname === "/api/backups") {
    const body = await parseBody(req);
    const { env, path: backupPath } = body;
    if (!env || !backupPath)
      return sendJson(res, 400, { error: "env and path are required" });
    const config = loadConfig({ rootDir, cliRetain: null });
    const server = config.servers?.[env];
    if (!server) return sendJson(res, 404, { error: "Env not found" });
    const { shSingleQuote } = await import("../utils/ssh");
    await runSsh(
      { ...server, key: path.resolve(rootDir, server.key) },
      `rm -rf ${shSingleQuote(backupPath)}`,
    );
    return sendJson(res, 200, { message: "Backup deleted" });
  }

  if (req.method === "PUT" && url.pathname === "/api/backups") {
    const body = await parseBody(req);
    const { env, oldPath, newName } = body;
    if (!env || !oldPath || !newName)
      return sendJson(res, 400, {
        error: "env, oldPath, and newName are required",
      });

    const config = loadConfig({ rootDir, cliRetain: null });
    const server = config.servers?.[env];
    if (!server) return sendJson(res, 404, { error: "Env not found" });

    // Calculate new path by replacing the filename in the old path
    const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/"));
    const newPath = `${parentDir}/${newName.trim()}`;

    const { shSingleQuote } = await import("../utils/ssh");
    try {
      await runSsh(
        { ...server, key: path.resolve(rootDir, server.key) },
        `mv ${shSingleQuote(oldPath)} ${shSingleQuote(newPath)}`,
      );
      return sendJson(res, 200, { message: "Backup renamed", newPath });
    } catch (err: any) {
      return sendJson(res, 500, {
        error: `Failed to rename on server: ${err.message}`,
      });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/backups") {
    const body = await parseBody(req);
    const { env } = body;
    if (!env || !SUPPORTED_ENVS.includes(env))
      return sendJson(res, 400, { error: "Invalid env" });
    const { createBackup } = await import("../backup/backupManager");
    const config = loadConfig({ rootDir, cliRetain: null });
    const report = await createBackup({
      rootDir,
      config,
      envName: env,
      deploymentVersion: "manual",
      label: "Manual",
    });
    return sendJson(res, 200, { message: "Backup created", report });
  }

  if (req.method === "GET" && url.pathname === "/api/logs") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    const onLog = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    logEmitter.on("log", onLog);
    req.on("close", () => logEmitter.off("log", onLog));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/deploy") {
    const body = await parseBody(req);
    const sourceEnv = String(body.sourceEnv || "dev").toLowerCase();
    const targetEnv = String(body.targetEnv || "qa").toLowerCase();
    const cliRetain = Number.isInteger(body.retain) ? body.retain : null;
    const dryRun = Boolean(body.dryRun);
    const gamePath = body.gamePath ? String(body.gamePath).trim() : null;
    const backupGames = body.backupGames
      ? String(body.backupGames)
          .split(",")
          .map((s: string) => s.trim())
      : [];
    const skipJsonBackup = Boolean(body.skipJsonBackup);

    if (!SUPPORTED_ENVS.includes(sourceEnv))
      return sendJson(res, 400, { error: `Invalid source env: ${sourceEnv}` });
    if (!SUPPORTED_ENVS.includes(targetEnv))
      return sendJson(res, 400, { error: `Invalid target env: ${targetEnv}` });

    const config = loadConfig({ rootDir, cliRetain });
    const gamePaths = gamePath
      ? gamePath.split(",").map((s: string) => s.trim())
      : [null];
    const deploymentReports = [];
    const stats = [];

    for (const singleGamePath of gamePaths) {
      const gameStart = Date.now();
      let currentGameStatus = "SUCCESS";
      try {
        // Determine if this specific game needs a backup
        const skipThisGameBackup = !backupGames.includes(
          singleGamePath || "Core",
        );

        const report = await deployEnvironment({
          rootDir,
          config,
          sourceEnv,
          targetEnv,
          gamePath: singleGamePath,
          skipGameBackup: skipThisGameBackup,
          dryRun,
        });
        deploymentReports.push(report);
        if (report.status !== "success") currentGameStatus = "FAILED";
      } catch (error: any) {
        logger.error(
          `Deployment failed for ${singleGamePath || "Core"}: ${error.message}`,
        );
        deploymentReports.push({
          gamePath: singleGamePath,
          status: "failed",
          error: error.message,
        });
        currentGameStatus = "FAILED";
      } finally {
        const gameEnd = Date.now();
        const durationSeconds = (gameEnd - gameStart) / 1000;
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = (durationSeconds % 60).toFixed(1);
        const durationStr =
          minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        const displayName =
          singleGamePath === "content"
            ? "CONTENT FOLDER"
            : singleGamePath || "CORE ASSETS";

        if (currentGameStatus === "SUCCESS") {
          logger.info(`Syncing Completed for ${displayName}`);
        }
        logger.info(`${displayName} : ${currentGameStatus} [${durationStr}]`);

        stats.push({
          name: displayName,
          duration: durationStr,
          status: currentGameStatus,
        });
      }
    }

    await saveHistory(rootDir, deploymentReports);
    if (stats.length > 0) {
      logger.info(
        `\n┌${"─".repeat(50)}┐\n│ DEPLOYMENT SUMMARY${" ".repeat(32)}│\n├${"─".repeat(50)}┤\n${stats
          .map((s) => {
            const statusStr =
              s.status === "SUCCESS" ? "✅ SUCCESS" : "❌ FAILED";
            return `│ ${s.name.padEnd(22)}: ${s.duration.padEnd(10)} [${statusStr.padEnd(10)}] │`;
          })
          .join("\n")}\n└${"─".repeat(50)}┘\n`,
      );
    }

    return sendJson(res, 200, {
      deployment:
        deploymentReports.length === 1
          ? deploymentReports[0]
          : deploymentReports,
      cleanup: null,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/stop") {
    const killedCount = killActiveProcesses();
    logger.warn(
      `Manual stop requested: Killed ${killedCount} active processes.`,
    );
    return sendJson(res, 200, { success: true, killedCount });
  }

  if (req.method === "POST" && url.pathname === "/api/restart") {
    logger.info("Server restart requested via UI...");
    sendJson(res, 200, { message: "Server is restarting..." });
    setTimeout(() => process.exit(0), 1000);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/shutdown") {
    logger.warn("Server shutdown requested via UI...");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Server is shutting down..." }));
    setTimeout(() => process.exit(0), 500);
    return;
  }

  return sendJson(res, 404, { error: "Not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/api/")) return await handleApi(req, res);

    if (!fs.existsSync(reactDistDir)) {
      res.writeHead(404);
      return res.end(
        "UI build not found. Run `npm run web:build:debug` first.",
      );
    }

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const requestPath = decodeURIComponent(url.pathname);
    const rawPath = requestPath === "/" ? "/index.html" : requestPath;
    const requestedFile = path.join(reactDistDir, rawPath.replace(/^\/+/, ""));
    const normalizedRequested = path.normalize(requestedFile);
    const normalizedRoot = path.normalize(reactDistDir);

    if (!normalizedRequested.startsWith(normalizedRoot)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    if (
      fs.existsSync(normalizedRequested) &&
      fs.statSync(normalizedRequested).isFile()
    ) {
      return await serveFile(res, normalizedRequested);
    }

    const indexPath = path.join(reactDistDir, "index.html");
    if (!fs.existsSync(indexPath)) {
      res.writeHead(404);
      return res.end("UI build index.html not found.");
    }
    return await serveFile(res, indexPath);
  } catch (error: any) {
    sendJson(res, 500, { error: error.message });
  }
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Retrying in 1s...`);
    setTimeout(() => {
      server.close();
      server.listen(port, "0.0.0.0");
    }, 1000);
  } else {
    throw err;
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Deployment UI available at http://localhost:${port}`);
  console.log(`Network access: http://10.0.0.231:${port}`);
});
