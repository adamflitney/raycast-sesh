import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { parse } from "yaml";

interface SeshConfig {
  project_directories?: string[];
}

const CONFIG_PATH = join(homedir(), ".config", "sesh", "config.yaml");
const DEFAULT_DIRS = [join(homedir(), "dev")];

function expandPath(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  if (path === "~") {
    return homedir();
  }
  return path;
}

export async function getProjectDirectories(): Promise<string[]> {
  try {
    const content = await readFile(CONFIG_PATH, "utf-8");
    const config = parse(content) as SeshConfig;
    const dirs = config?.project_directories;
    if (dirs && dirs.length > 0) {
      return dirs.map(expandPath);
    }
  } catch {
    // Config file missing or invalid — use defaults
  }
  return DEFAULT_DIRS;
}
