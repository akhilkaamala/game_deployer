export type DeployEnvironment = "dev" | "qa" | "preprod";

export interface DeployRequest {
  sourceEnv: DeployEnvironment;
  targetEnv: DeployEnvironment;
  retain: number | null;
  dryRun: boolean;
  gamePath: string | null;
  backupGames?: string | null;
  skipGameBackup?: boolean;
  skipJsonBackup?: boolean;
}

export interface DeployResponse {
  deployment: Record<string, unknown>;
  cleanup: Record<string, unknown> | null;
}

export interface ServerInfo {
  host: string;
  siteUrl?: string;
  destinationName?: string;
}

export interface ConfigResponse {
  environments: DeployEnvironment[];
  retention: Record<string, number>;
  gameCatalog: string[];
  gameFolderMap: Record<string, string | { path: string; jsonExt: string }>;
  sourcePath: string;
  serverBasePaths: Record<string, string>;
  jsonRootPaths: Record<string, string>;
  serverInfo: Record<string, ServerInfo>;
}
