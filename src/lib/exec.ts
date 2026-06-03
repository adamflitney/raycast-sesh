import { exec, execFile } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const EXTRA_PATH = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";

function buildEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };

  // Strip TMUX env var to allow tmux commands from any context
  delete env.TMUX;

  // Ensure brew and standard paths are available
  env.PATH = `${EXTRA_PATH}:${env.PATH || ""}`;

  return env;
}

export async function execCommand(cmd: string): Promise<string> {
  const { stdout } = await execAsync(cmd, { env: buildEnv() });
  return stdout.trim();
}

/**
 * Runs a binary with an argv array, avoiding shell-quoting pitfalls when
 * arguments contain quotes, newlines, or AppleScript syntax.
 */
export async function execBinary(
  file: string,
  args: string[],
): Promise<string> {
  const { stdout } = await execFileAsync(file, args, { env: buildEnv() });
  return stdout.trim();
}
