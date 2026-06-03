import { execCommand } from "./exec";

export function sanitizeSessionName(name: string): string {
  let sanitized = name.replace(/[^a-zA-Z0-9_-]+/g, "-");
  sanitized = sanitized.replace(/^-+|-+$/g, "");
  return sanitized.toLowerCase();
}

export async function listSessions(): Promise<string[]> {
  try {
    const output = await execCommand('tmux list-sessions -F "#{session_name}"');
    return output.split("\n").filter((line) => line.length > 0);
  } catch {
    // tmux not running or not installed
    return [];
  }
}

export interface TmuxClient {
  tty: string;
  session: string;
  activity: number;
}

export async function listClients(): Promise<TmuxClient[]> {
  try {
    const output = await execCommand(
      'tmux list-clients -F "#{client_tty}:#{client_session}:#{client_activity}"',
    );
    return output
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => {
        const parts = line.split(":");
        return {
          tty: parts[0],
          session: parts[1],
          activity: parseInt(parts[2], 10) || 0,
        };
      });
  } catch {
    return [];
  }
}

export function getMostRecentClient(clients: TmuxClient[]): TmuxClient | null {
  if (clients.length === 0) return null;
  return clients.reduce((best, client) =>
    client.activity > best.activity ? client : best,
  );
}

export async function createSession(
  sessionName: string,
  projectPath: string,
): Promise<void> {
  const quotedSession = shellQuote(sessionName);
  const quotedPath = shellQuote(projectPath);

  // 1. Create session with neovim window
  await execCommand(
    `tmux new-session -d -s ${quotedSession} -c ${quotedPath} -n neovim`,
  );

  // 2. Run nvim in the neovim window
  await execCommand(
    `tmux send-keys -t ${shellQuote(sessionName + ":neovim")} "nvim ." Enter`,
  );

  // 3. Create claude window and run claude in it
  await execCommand(
    `tmux new-window -t ${quotedSession} -n claude -c ${quotedPath}`,
  );
  await execCommand(
    `tmux send-keys -t ${shellQuote(sessionName + ":claude")} "claude" Enter`,
  );

  // 4. Create shell window (plain zsh, no command)
  await execCommand(
    `tmux new-window -t ${quotedSession} -n shell -c ${quotedPath}`,
  );

  // 5. Select neovim window as the starting window
  await execCommand(
    `tmux select-window -t ${shellQuote(sessionName + ":neovim")}`,
  );
}

export async function listWindows(sessionName: string): Promise<string[]> {
  try {
    const output = await execCommand(
      `tmux list-windows -t ${shellQuote(sessionName)} -F "#{window_name}"`,
    );
    return output.split("\n").filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

export async function getSessionPath(sessionName: string): Promise<string> {
  try {
    return await execCommand(
      `tmux display-message -p -t ${shellQuote(sessionName)} "#{session_path}"`,
    );
  } catch {
    return "";
  }
}

/**
 * Brings an existing session up to the default 3-window layout (neovim,
 * claude, shell) without touching any windows the user has already set up.
 * Any missing window is appended; existing ones are left alone.
 *
 * Pass `projectPath` when known. Otherwise we fall back to the session's own
 * starting path via `#{session_path}`.
 */
export async function ensureSessionWindows(
  sessionName: string,
  projectPath?: string,
): Promise<{ added: string[] }> {
  const existing = new Set(await listWindows(sessionName));
  const path = projectPath || (await getSessionPath(sessionName));
  if (!path) return { added: [] };

  const quotedSession = shellQuote(sessionName);
  const quotedPath = shellQuote(path);
  const added: string[] = [];

  if (!existing.has("neovim")) {
    await execCommand(
      `tmux new-window -t ${quotedSession} -n neovim -c ${quotedPath}`,
    );
    await execCommand(
      `tmux send-keys -t ${shellQuote(sessionName + ":neovim")} "nvim ." Enter`,
    );
    added.push("neovim");
  }

  if (!existing.has("claude")) {
    await execCommand(
      `tmux new-window -t ${quotedSession} -n claude -c ${quotedPath}`,
    );
    await execCommand(
      `tmux send-keys -t ${shellQuote(sessionName + ":claude")} "claude" Enter`,
    );
    added.push("claude");
  }

  if (!existing.has("shell")) {
    await execCommand(
      `tmux new-window -t ${quotedSession} -n shell -c ${quotedPath}`,
    );
    added.push("shell");
  }

  return { added };
}

export async function switchClient(
  sessionName: string,
  clientTty: string,
): Promise<void> {
  await execCommand(
    `tmux switch-client -t ${shellQuote(sessionName)} -c ${shellQuote(clientTty)}`,
  );
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
