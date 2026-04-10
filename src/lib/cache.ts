import { readFile, writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join, dirname } from "path";
import { execCommand } from "./exec";

interface RecentProject {
  name: string;
  path: string;
  last_used: string;
}

interface RecentCache {
  projects: RecentProject[];
}

const CACHE_PATH = join(homedir(), ".cache", "sesh", "recent.json");

export async function loadRecent(): Promise<RecentCache> {
  try {
    const content = await readFile(CACHE_PATH, "utf-8");
    const cache = JSON.parse(content) as RecentCache;
    if (cache?.projects) return cache;
  } catch {
    // File missing or invalid
  }
  return { projects: [] };
}

export async function addRecent(name: string, path: string): Promise<void> {
  const cache = await loadRecent();

  // Remove if already exists
  cache.projects = cache.projects.filter((p) => p.path !== path);

  // Add to front
  cache.projects.unshift({
    name,
    path,
    last_used: new Date().toISOString(),
  });

  // Keep only top 3
  cache.projects = cache.projects.slice(0, 3);

  // Write back
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));

  // Also add to zoxide
  try {
    await execCommand(`zoxide add ${shellQuote(path)}`);
  } catch {
    // zoxide not installed
  }
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
