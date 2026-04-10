import { execCommand } from "./exec";

export function sanitizeSessionName(name: string): string {
  let sanitized = name.replace(/[^a-zA-Z0-9_-]+/g, "-");
  sanitized = sanitized.replace(/^-+|-+$/g, "");
  return sanitized.toLowerCase();
}

export async function listSessions(): Promise<string[]> {
  try {
    const output = await execCommand('tmux list-sessions -F "#{session_name}"');
    return output
      .split("\n")
      .filter((line) => line.length > 0);
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
      'tmux list-clients -F "#{client_tty}:#{client_session}:#{client_activity}"'
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
    client.activity > best.activity ? client : best
  );
}

export async function createSession(sessionName: string, projectPath: string): Promise<void> {
  // 1. Create session with neovim window
  await execCommand(
    `tmux new-session -d -s ${shellQuote(sessionName)} -c ${shellQuote(projectPath)} -n neovim`
  );

  // 2. Send nvim command
  await execCommand(
    `tmux send-keys -t ${shellQuote(sessionName + ":neovim")} "nvim ." Enter`
  );

  // 3. Create zsh window
  await execCommand(
    `tmux new-window -t ${shellQuote(sessionName)} -n zsh -c ${shellQuote(projectPath)}`
  );

  // 4. Select neovim window
  await execCommand(
    `tmux select-window -t ${shellQuote(sessionName + ":neovim")}`
  );
}

export async function switchClient(sessionName: string, clientTty: string): Promise<void> {
  await execCommand(
    `tmux switch-client -t ${shellQuote(sessionName)} -c ${shellQuote(clientTty)}`
  );
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
