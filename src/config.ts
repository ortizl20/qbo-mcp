import { config as loadDotenv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig, BackendMode } from "./types.js";

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SRC_DIR, "..");

loadDotenv({ path: path.join(REPO_ROOT, ".env") });

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return /replace|your_|example|placeholder|changeme|^sandbox$|^todo$/i.test(value);
}

function truthy(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return !/^(0|false|off|no)$/i.test(value);
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const clientId = process.env.INTUIT_CLIENT_ID ?? "";
  const requestedMode = (process.env.QBO_MODE ?? "").toLowerCase();
  let mode: BackendMode;
  if (requestedMode === "live") mode = "live";
  else if (requestedMode === "fixture") mode = "fixture";
  else mode = isPlaceholder(clientId) ? "fixture" : "live";

  const fixtureDir = process.env.QBO_FIXTURE_DIR
    ? path.resolve(process.env.QBO_FIXTURE_DIR)
    : path.join(REPO_ROOT, "fixtures", "acme");

  const tokensPath = process.env.QBO_TOKENS_PATH
    ? path.resolve(process.env.QBO_TOKENS_PATH)
    : path.join(REPO_ROOT, ".qbo-tokens.json");

  const intuitEnv = process.env.INTUIT_ENV === "production" ? "production" : "sandbox";

  return {
    intuitClientId: clientId,
    intuitClientSecret: process.env.INTUIT_CLIENT_SECRET ?? "",
    intuitRedirectUri: process.env.INTUIT_REDIRECT_URI ?? "http://localhost:8000/callback",
    intuitEnv,
    dryRun: truthy(process.env.QBO_DRY_RUN, true),
    mode,
    fixtureDir,
    tokensPath,
    repoRoot: REPO_ROOT,
    ...overrides,
  };
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
