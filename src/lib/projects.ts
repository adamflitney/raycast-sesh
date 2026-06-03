import { readdir, stat } from "fs/promises";
import { join, basename } from "path";

export interface Project {
  name: string;
  path: string;
}

const SKIP_DIRS = new Set([
  "node_modules",
  "vendor",
  "target",
  "build",
  "dist",
  ".next",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
]);

export async function findGitProjects(
  directories: string[],
): Promise<Project[]> {
  const projectsMap = new Map<string, Project>();

  for (const dir of directories) {
    try {
      await walkForGitProjects(dir, projectsMap);
    } catch {
      // Skip directories that don't exist or can't be read
    }
  }

  return Array.from(projectsMap.values());
}

async function walkForGitProjects(
  dir: string,
  projects: Map<string, Project>,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    if (entry.name === ".git") {
      // Parent directory is a git project
      projects.set(dir, {
        name: basename(dir),
        path: dir,
      });
      return; // Don't descend further into this project
    }

    if (SKIP_DIRS.has(entry.name)) continue;

    await walkForGitProjects(join(dir, entry.name), projects);
  }
}
