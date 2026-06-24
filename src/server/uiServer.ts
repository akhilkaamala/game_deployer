import fs from "node:fs";
import { exec } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import os from "node:os";
import { loadConfig, SUPPORTED_ENVS } from "../config/loadConfig";
import {
  getAllSshKeys,
  resolveKeyPath,
  setSshKeyPath,
} from "../config/localKeys";
import { deployEnvironment } from "../deployment/deployService";
import { runPostDeploymentCleanup } from "../deployment/cleanupScheduler";
import { listBackups, streamBackups } from "../backup/backupManager";
import { runSsh, killActiveProcesses, shSingleQuote } from "../utils/ssh";
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
// PEM files live outside the shared config (deployment.local.json or env vars).
// On cloud deployments, set SSH_KEY_<ENVNAME> — keys are written to keys/ at runtime.
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

  for (const [envName] of Object.entries(config.servers || {}) as [
    string,
    any,
  ][]) {
    const envVarName = `SSH_KEY_${envName.toUpperCase().replace(/-/g, "_")}`;
    const keyContent = process.env[envVarName];

    if (keyContent) {
      if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });
      const keyPath = path.join(keysDir, `${envName}.pem`);
      fs.writeFileSync(keyPath, keyContent.replace(/\\n/g, "\n"), {
        mode: 0o600,
      });
      setSshKeyPath(rootDir, envName, keyPath);
      console.log(
        `[bootstrap] Wrote SSH key for '${envName}' from env var ${envVarName}`,
      );
    }
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

let cachedSizes: Record<string, number> = {};
let lastFetch = 0;
let fetchPromise: Promise<Record<string, number>> | null = null;
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes
const S3_SIZE_CACHE_TTL = 1000 * 60 * 10; // 10 minutes
const S3_QUERY_TIMEOUT_MS = 20000;
const CLOUDFRONT_QUERY_TIMEOUT_MS = 12000;
const s3UsageCache = new Map<
  string,
  { bytes: number | null; error?: string; fetchedAt: number }
>();
const cloudFrontBucketCache = new Map<
  string,
  { bucket: string | null; error?: string; fetchedAt: number }
>();

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Connection timed out")), timeoutMs);
    }),
  ]);
}

async function getS3UsageBytes(
  server: any,
  bucket: string,
): Promise<{ bytes: number | null; error?: string }> {
  const now = Date.now();
  const cached = s3UsageCache.get(bucket);
  if (cached && now - cached.fetchedAt < S3_SIZE_CACHE_TTL) {
    return { bytes: cached.bytes, error: cached.error };
  }

  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    return { bytes: null, error: "Invalid bucket name" };
  }

  const command = `aws s3 ls ${shSingleQuote(`s3://${bucket}`)} --recursive --summarize | awk '/Total Size:/ {print $3}'`;

  try {
    const { stdout } = await withTimeout(
      runSsh({ ...server, key: server.key }, command),
      S3_QUERY_TIMEOUT_MS,
    );
    const output = stdout.trim().split(/\r?\n/).pop() || "";
    const parsed = Number.parseInt(output, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      const result = { bytes: null, error: "Could not read S3 size" };
      s3UsageCache.set(bucket, { ...result, fetchedAt: now });
      return result;
    }

    const result = { bytes: parsed };
    s3UsageCache.set(bucket, { ...result, fetchedAt: now });
    return result;
  } catch (e: any) {
    const result = {
      bytes: null,
      error: e?.message?.split("\n")[0] || "S3 size check failed",
    };
    s3UsageCache.set(bucket, { ...result, fetchedAt: now });
    return result;
  }
}

function inferBucketFromOriginDomain(domain: string): string | null {
  const normalized = domain.trim().toLowerCase();
  if (!normalized || normalized === "none") return null;

  const s3Pattern =
    /^(?<bucket>[a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/;
  const websitePattern =
    /^(?<bucket>[a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\.s3-website(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/;

  return (
    s3Pattern.exec(normalized)?.groups?.bucket ||
    websitePattern.exec(normalized)?.groups?.bucket ||
    null
  );
}

async function inferS3BucketFromCloudFront(
  server: any,
  distributionId: string,
): Promise<{ bucket: string | null; error?: string }> {
  const cacheKey = `cf:${distributionId}`;
  const now = Date.now();
  const cached = cloudFrontBucketCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < S3_SIZE_CACHE_TTL) {
    return { bucket: cached.bucket, error: cached.error };
  }

  const command = `aws cloudfront get-distribution --id ${shSingleQuote(
    distributionId,
  )} --query 'Distribution.DistributionConfig.Origins.Items[0].DomainName' --output text`;

  try {
    const { stdout } = await withTimeout(
      runSsh({ ...server, key: server.key }, command),
      CLOUDFRONT_QUERY_TIMEOUT_MS,
    );
    const domain = stdout.trim().split(/\r?\n/).pop() || "";
    const bucket = inferBucketFromOriginDomain(domain);
    if (!bucket) {
      const result = {
        bucket: null,
        error: "CloudFront origin is not an S3 bucket",
      };
      cloudFrontBucketCache.set(cacheKey, { ...result, fetchedAt: now });
      return result;
    }
    const result = { bucket };
    cloudFrontBucketCache.set(cacheKey, { ...result, fetchedAt: now });
    return result;
  } catch (e: any) {
    const result = {
      bucket: null,
      error: e?.message?.split("\n")[0] || "CloudFront lookup failed",
    };
    cloudFrontBucketCache.set(cacheKey, { ...result, fetchedAt: now });
    return result;
  }
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

async function getFolderSize(folderPath: string): Promise<number> {
  return new Promise((resolve) => {
    // -s: summary, -k: kilobytes
    exec(`du -sk "${folderPath}"`, (err, stdout) => {
      if (err) return resolve(0);
      const match = stdout.trim().match(/^(\d+)/);
      if (match) {
        resolve(Number.parseInt(match[1], 10) * 1024); // Convert KB to bytes
      } else {
        resolve(0);
      }
    });
  });
}

async function serveFile(
  res: http.ServerResponse,
  filePath: string,
): Promise<void> {
  const data = await fsp.readFile(filePath);
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  res.end(data);
}

async function saveHistory(rootDir: string, reports: any[], deployedBy?: string) {
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
    deployedBy: deployedBy || "unknown",
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
    return sendJson(res, 200, {
      status: "ok",
      uptime: process.uptime(),
      platform: process.platform,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/browse-key") {
    if (process.platform !== "darwin") {
      return sendJson(res, 400, {
        error: "Native file picker only supported on macOS",
      });
    }
    const command = `osascript -e 'POSIX path of (choose file with prompt "Select your SSH Private Key (.pem)")'`;
    exec(command, (err, stdout) => {
      if (err) return sendJson(res, 200, { cancelled: true });
      const selectedPath = stdout.trim();
      return sendJson(res, 200, { path: selectedPath });
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/ssh-keys") {
    const keys = getAllSshKeys(rootDir);
    const linked: Record<string, { path: string; exists: boolean }> = {};
    for (const [name, keyPath] of Object.entries(keys)) {
      const resolved = resolveKeyPath(rootDir, keyPath);
      linked[name] = {
        path: keyPath,
        exists: Boolean(resolved && fs.existsSync(resolved)),
      };
    }
    return sendJson(res, 200, { keys: linked });
  }

  const sshKeyMatch = url.pathname.match(/^\/api\/ssh-keys\/([^/]+)$/);
  if (req.method === "PUT" && sshKeyMatch) {
    const envName = decodeURIComponent(sshKeyMatch[1]);
    const { path: keyPath } = await parseBody(req);
    if (!keyPath?.trim()) {
      return sendJson(res, 400, { error: "path is required" });
    }
    const resolved = resolveKeyPath(rootDir, keyPath);
    if (!fs.existsSync(resolved)) {
      return sendJson(res, 400, {
        error: `SSH key not found at ${resolved}`,
      });
    }
    const mainConfigPath = path.join(rootDir, "deployment.config.json");
    const raw = JSON.parse(fs.readFileSync(mainConfigPath, "utf-8"));
    if (!raw.servers?.[envName]) {
      return sendJson(res, 404, { error: "Environment not found" });
    }
    setSshKeyPath(rootDir, envName, resolved);
    logger.info(`SSH key linked for environment: ${envName}`);
    return sendJson(res, 200, {
      message: "Key linked successfully",
      path: resolved,
    });
  }

  if (req.method === "DELETE" && sshKeyMatch) {
    const envName = decodeURIComponent(sshKeyMatch[1]);
    setSshKeyPath(rootDir, envName, null);
    logger.info(`SSH key unlinked for environment: ${envName}`);
    return sendJson(res, 200, { message: "Key unlinked" });
  }

  if (req.method === "GET" && url.pathname === "/api/system-health") {
    const config = loadConfig({ rootDir, cliRetain: null });
    const mem = process.memoryUsage();
    const servers = config.servers || {};

    const SSH_TIMEOUT_MS = 6000;
    const envChecks = await Promise.all(
      Object.entries(servers).map(async ([name, srv]: [string, any]) => {
        const start = Date.now();
        let s3Bucket =
          typeof srv.s3Bucket === "string" && srv.s3Bucket.trim()
            ? srv.s3Bucket.trim()
            : null;
        const distributionId =
          typeof srv.cloudfrontDistribution === "string" &&
            srv.cloudfrontDistribution.trim()
            ? srv.cloudfrontDistribution.trim()
            : null;
        try {
          await withTimeout(
            runSsh({ ...srv, key: srv.key }, "echo ok"),
            SSH_TIMEOUT_MS,
          );

          let s3UsageBytes: number | null = null;
          let s3UsageError: string | undefined;
          if (!s3Bucket && distributionId) {
            const inferred = await inferS3BucketFromCloudFront(
              srv,
              distributionId,
            );
            if (inferred.bucket) {
              s3Bucket = inferred.bucket;
            } else if (inferred.error) {
              s3UsageError = inferred.error;
            }
          }
          if (s3Bucket) {
            const s3Usage = await getS3UsageBytes(srv, s3Bucket);
            s3UsageBytes = s3Usage.bytes;
            s3UsageError = s3Usage.error;
          }

          return {
            name,
            status: "online",
            latencyMs: Date.now() - start,
            s3Bucket,
            s3UsageBytes,
            s3UsageError,
          };
        } catch (e: any) {
          return {
            name,
            status: "offline",
            error: e.message?.split("\n")[0] || "Connection failed",
            latencyMs: Date.now() - start,
            s3Bucket,
            s3UsageBytes: null,
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
          systemTotal: Math.round(os.totalmem() / 1024 / 1024),
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
    raw.servers[name] = { ...serverConfig, key: "" };
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

    const keysDir = path.resolve(rootDir, "keys");
    if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });
    const keyPath = path.join(keysDir, `${name}.pem`);
    fs.writeFileSync(keyPath, keyContent, { mode: 0o600 });
    setSshKeyPath(rootDir, name, keyPath);

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

    if (body.key !== undefined) {
      const keyValue = String(body.key || "").trim();
      if (keyValue) {
        const resolved = resolveKeyPath(rootDir, keyValue);
        if (!fs.existsSync(resolved)) {
          return sendJson(res, 400, {
            error: `SSH key not found at ${resolved}`,
          });
        }
        setSshKeyPath(rootDir, envName, resolved);
      } else {
        setSshKeyPath(rootDir, envName, null);
      }
      delete body.key;
      raw.servers[envName].key = "";
    }

    raw.servers[envName] = { ...raw.servers[envName], ...body, key: "" };
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
    const { name, path: gamePath, jsonExt, image } = body;
    if (!name || !gamePath || !jsonExt)
      return sendJson(res, 400, {
        error: "name, path, and jsonExt are required",
      });
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (!raw.gameFolderMap) raw.gameFolderMap = {};
    if (raw.gameFolderMap[name])
      return sendJson(res, 409, { error: `Game '${name}' already exists` });
    raw.gameFolderMap[name] = { path: gamePath, jsonExt, image };
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
    const { newName, path: gamePath, jsonExt, image } = body;
    if (newName && newName !== gameName) {
      raw.gameFolderMap[newName] = {
        path: gamePath || raw.gameFolderMap[gameName].path,
        jsonExt: jsonExt || raw.gameFolderMap[gameName].jsonExt,
        image: image !== undefined ? image : raw.gameFolderMap[gameName].image,
      };
      delete raw.gameFolderMap[gameName];
    } else {
      raw.gameFolderMap[gameName] = {
        path: gamePath || raw.gameFolderMap[gameName].path,
        jsonExt: jsonExt || raw.gameFolderMap[gameName].jsonExt,
        image: image !== undefined ? image : raw.gameFolderMap[gameName].image,
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
    const sshKeys = getAllSshKeys(rootDir);
    const sshKeyStatus = Object.fromEntries(
      SUPPORTED_ENVS.map((name) => {
        const keyPath = config.servers?.[name]?.key || "";
        return [
          name,
          {
            linked: Boolean(keyPath && fs.existsSync(keyPath)),
            path: sshKeys[name] || null,
          },
        ];
      }),
    );
    return sendJson(res, 200, {
      environments: SUPPORTED_ENVS,
      retention: config.backupRetention,
      gameCatalog: extractGameCatalog(config),
      gameFolderMap: config.gameFolderMap || {},
      sourcePath: config.paths?.sourcePath || "",
      sshKeyStatus,
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
      serverInfo: Object.fromEntries(
        Object.entries(config.servers).map(([name, s]: any) => [
          name,
          {
            host: s.host || "",
            siteUrl: s.siteUrl || "",
            destinationName: s.destinationName || "",
          },
        ]),
      ),
    });
  }

  if (req.method === "GET" && url.pathname === "/api/game-sizes") {
    const now = Date.now();
    if (now - lastFetch < CACHE_TTL && Object.keys(cachedSizes).length > 0) {
      return sendJson(res, 200, cachedSizes);
    }

    // Prevent parallel fetches by returning the existing promise
    if (fetchPromise) {
      const results = await fetchPromise;
      return sendJson(res, 200, results);
    }

    fetchPromise = (async () => {
      try {
        const config = loadConfig({ rootDir, cliRetain: null });
        const gameBase = config.paths?.sourcePath;
        if (!gameBase) return {};

        const absoluteBase = path.isAbsolute(gameBase)
          ? gameBase
          : path.resolve(rootDir, gameBase);

        const sizes: Record<string, number> = {};

        if (fs.existsSync(absoluteBase)) {
          const entries = fs.readdirSync(absoluteBase, { withFileTypes: true });
          await Promise.all(
            entries
              .filter((entry) => entry.isDirectory())
              .map(async (entry) => {
                const folderPath = path.join(absoluteBase, entry.name);
                sizes[entry.name] = await getFolderSize(folderPath);
              }),
          );
        } else {
          const devServer = config.servers?.dev;
          if (devServer) {
            try {
              const resolvedKey = path.resolve(rootDir, devServer.key);
              const remoteBase = gameBase.endsWith("/")
                ? gameBase.slice(0, -1)
                : gameBase;

              logger.info(`Fetching remote game sizes from ${devServer.host}...`);
              const { stdout } = await runSsh(
                { ...devServer, key: resolvedKey },
                `du -sk ${remoteBase}/*/ 2>/dev/null`,
              );

              if (stdout) {
                const lines = stdout.split("\n");
                for (const line of lines) {
                  const match = line.trim().match(/^(\d+)\s+(.+)$/);
                  if (match) {
                    const kb = Number.parseInt(match[1], 10);
                    const fullPath = match[2].replace(/\/$/, "");
                    const folderName = path.basename(fullPath);
                    sizes[folderName] = kb * 1024;
                  }
                }
              }
            } catch (err: any) {
              logger.error(`Failed to fetch remote game sizes: ${err.message}`);
            }
          }
        }

        if (Object.keys(sizes).length > 0) {
          cachedSizes = sizes;
          lastFetch = Date.now();
        }
        return sizes;
      } finally {
        fetchPromise = null;
      }
    })();

    const result = await fetchPromise;
    return sendJson(res, 200, result);
  }

  if (req.method === "GET" && url.pathname === "/api/game-sizes/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    });
    // Ensure headers are sent immediately
    if (res.flushHeaders) res.flushHeaders();

    const config = loadConfig({ rootDir, cliRetain: null });
    const gameBase = config.paths?.sourcePath;
    const envName = url.searchParams.get("env") || "dev";
    const targetServer = config.servers?.[envName];

    if (!gameBase || !targetServer) {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    const resolvedKey = path.resolve(rootDir, targetServer.key);
    const remoteBase = gameBase.endsWith("/") ? gameBase.slice(0, -1) : gameBase;

    logger.info(`Streaming remote game sizes from ${targetServer.host}...`);

    const { spawnSsh } = await import("../utils/ssh");
    // Use a shell loop to get sizes and mod time one by one on the remote side
    const command = `for d in ${remoteBase}/*/ ; do [ -d "$d" ] && echo "$(du -sk "$d" | cut -f1) $(stat -c %Y "$d" 2>/dev/null || stat -f %m "$d" 2>/dev/null || echo 0) $d" ; done`;

    spawnSsh(
      { ...targetServer, key: resolvedKey },
      command,
      (line) => {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
        if (match) {
          const kb = Number.parseInt(match[1], 10);
          const timestamp = Number.parseInt(match[2], 10);
          const fullPath = match[3].replace(/\/$/, "");
          const folderName = path.basename(fullPath);
          const size = kb * 1024;

          // Update local cache
          cachedSizes[folderName] = size;

          res.write(`data: ${JSON.stringify({ folder: folderName, size, timestamp })}\n\n`);
        } else {
          // Fallback if stat fails and it just outputs size and path
          const fallbackMatch = line.trim().match(/^(\d+)\s+(.+)$/);
          if (fallbackMatch && !fallbackMatch[2].match(/^\d+\s+/)) {
            const kb = Number.parseInt(fallbackMatch[1], 10);
            const fullPath = fallbackMatch[2].replace(/\/$/, "");
            const folderName = path.basename(fullPath);
            const size = kb * 1024;
            cachedSizes[folderName] = size;
            res.write(`data: ${JSON.stringify({ folder: folderName, size })}\n\n`);
          }
        }
      },
      (errLine) => {
        if (errLine.includes("Permission denied") || errLine.includes("No such file")) {
          // log but continue
        }
      },
    )
      .then(() => {
        lastFetch = Date.now();
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      })
      .catch((err) => {
        logger.error(`SSH stream failed: ${err.message}`);
        res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
        res.end();
      });

    req.on("close", () => {
      // Logic to kill if needed, but spawnSsh handles activeProcesses
    });
    return;
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
    const deployedBy = body.deployedBy ? String(body.deployedBy).trim() : "unknown";

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
        deploymentReports.push({ ...report, sourceEnvironment: sourceEnv });
        if (report.status !== "success") currentGameStatus = "FAILED";
      } catch (error: any) {
        logger.error(
          `Deployment failed for ${singleGamePath || "Core"}: ${error.message}`,
        );
        deploymentReports.push({
          gamePath: singleGamePath,
          status: "failed",
          error: error.message,
          sourceEnvironment: sourceEnv,
          environment: targetEnv,
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

        logger.info(`${displayName} : ${currentGameStatus} [${durationStr}]`);

        stats.push({
          name: displayName,
          duration: durationStr,
          status: currentGameStatus,
        });
      }
    }

    await saveHistory(rootDir, deploymentReports, deployedBy);

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
