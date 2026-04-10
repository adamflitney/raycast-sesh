import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const EXTRA_PATH = "/opt/homebrew/bin:/usr/local/bin";

export async function execCommand(cmd: string): Promise<string> {
  const env = { ...process.env };

  // Strip TMUX env var to allow tmux commands from any context
  delete env.TMUX;

  // Ensure brew and standard paths are available
  env.PATH = `${EXTRA_PATH}:${env.PATH || ""}`;

  const { stdout } = await execAsync(cmd, { env });
  return stdout.trim();
}
