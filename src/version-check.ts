/**
 * Auto-update: checks npm for newer version, clears npx cache if outdated.
 *
 * Flow:
 *   1. On startup, check npm registry (cached 24h in ~/.caravo/version-check.json)
 *   2. If a newer version exists and we're running from npx cache, delete our cache entry
 *   3. Next time the MCP host restarts the server, npx re-downloads the latest version
 *
 * All operations are non-fatal — errors are silently ignored.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".caravo");
const CACHE_FILE = join(CONFIG_DIR, "version-check.json");
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface VersionCache {
  [packageName: string]: {
    latest: string;
    checkedAt: number;
  };
}

export interface UpdateInfo {
  current: string;
  latest: string;
}

function isNewer(latest: string, current: string): boolean {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) !== (c[i] ?? 0)) return (l[i] ?? 0) > (c[i] ?? 0);
  }
  return false;
}

function readCache(): VersionCache {
  try {
    if (existsSync(CACHE_FILE)) {
      return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
    }
  } catch { /* ignore */ }
  return {};
}

function writeCache(cache: VersionCache): void {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch { /* ignore */ }
}

/**
 * Clear our package from the npx cache (~/.npm/_npx/).
 * This ensures the next `npx @caravo/mcp` invocation downloads the latest version.
 */
function clearNpxCache(packageName: string): void {
  const npxDir = join(homedir(), ".npm", "_npx");
  try {
    if (!existsSync(npxDir)) return;
    for (const entry of readdirSync(npxDir)) {
      const pkgJsonPath = join(npxDir, entry, "node_modules", packageName, "package.json");
      try {
        if (existsSync(pkgJsonPath)) {
          rmSync(join(npxDir, entry), { recursive: true, force: true });
        }
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }
}

/**
 * Check npm registry for a newer version.
 * Returns UpdateInfo if an update is available, null otherwise.
 * Automatically clears npx cache when outdated.
 */
export async function checkForUpdate(
  packageName: string,
  currentVersion: string
): Promise<UpdateInfo | null> {
  try {
    const cache = readCache();
    const cached = cache[packageName];
    const now = Date.now();

    // Use cache if fresh
    if (cached && now - cached.checkedAt < CHECK_INTERVAL_MS) {
      return isNewer(cached.latest, currentVersion)
        ? { current: currentVersion, latest: cached.latest }
        : null;
    }

    // Fetch from npm registry
    const resp = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return null;

    const data = (await resp.json()) as { version: string };
    const latest = data.version;

    // Update cache
    cache[packageName] = { latest, checkedAt: now };
    writeCache(cache);

    if (isNewer(latest, currentVersion)) {
      // Clear npx cache so next restart gets the new version
      clearNpxCache(packageName);
      return { current: currentVersion, latest };
    }

    return null;
  } catch {
    return null;
  }
}
