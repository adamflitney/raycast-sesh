import { execCommand } from "./exec";
import { loadRecent } from "./cache";
import { Project } from "./projects";

export interface ScoredProject extends Project {
  score: number;
}

async function getZoxideScores(): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  try {
    const output = await execCommand("zoxide query -l -s");
    for (const line of output.split("\n")) {
      if (!line) continue;
      // Format: "123.45 /Users/adam/Dev/project"
      const spaceIdx = line.trimStart().indexOf(" ");
      if (spaceIdx === -1) continue;
      const trimmed = line.trimStart();
      const scoreStr = trimmed.slice(0, spaceIdx);
      const path = trimmed.slice(spaceIdx + 1);
      const score = parseFloat(scoreStr);
      if (!isNaN(score)) {
        scores.set(path, score);
      }
    }
  } catch {
    // zoxide not installed or no data
  }
  return scores;
}

export async function scoreProjects(
  projects: Project[],
): Promise<ScoredProject[]> {
  const [zoxideScores, recent] = await Promise.all([
    getZoxideScores(),
    loadRecent(),
  ]);

  // Build recency rank map (1-indexed)
  const recentPaths = new Map<string, number>();
  const top3 = recent.projects.slice(0, 3);
  for (let i = 0; i < top3.length; i++) {
    recentPaths.set(top3[i].path, i + 1);
  }

  const scored: ScoredProject[] = projects.map((project) => {
    let score = 0;

    const zoxideScore = zoxideScores.get(project.path);
    if (zoxideScore !== undefined) {
      score += zoxideScore;
    }

    // Boost recent projects: rank 1 → +10000, rank 2 → +9000, rank 3 → +8000
    const rank = recentPaths.get(project.path);
    if (rank !== undefined) {
      score += 11000 - rank * 1000;
    }

    return { ...project, score };
  });

  // Sort by score desc, then name asc
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  return scored;
}
