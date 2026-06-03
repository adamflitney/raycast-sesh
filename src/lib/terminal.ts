import { execCommand, execBinary } from "./exec";

const TERMINAL_APP = "Ghostty";

async function isTerminalRunning(): Promise<boolean> {
  try {
    // pgrep -xi matches the exact (case-insensitive) binary name. Exit 0 means
    // at least one match.
    await execCommand(`pgrep -xi ${TERMINAL_APP}`);
    return true;
  } catch {
    return false;
  }
}

export async function focusTerminal(): Promise<void> {
  await execCommand(
    `osascript -e 'tell application "${TERMINAL_APP}" to activate'`,
  );
}

/**
 * Opens a Ghostty window running the given shell command.
 *
 * Background: on macOS, `open -na Ghostty --args -e <cmd>` is the only way to
 * hand Ghostty a command — but `-n` always spawns a *new* process. To reuse an
 * already-running Ghostty we drive it via AppleScript: activate it, send ⌘N
 * to open a new window, then type the command. This needs Accessibility
 * permission for Raycast (System Settings → Privacy & Security → Accessibility).
 */
export async function openTerminalWithCommand(command: string): Promise<void> {
  const running = await isTerminalRunning();

  if (!running) {
    // No Ghostty yet — launch a fresh instance and pass the command through.
    // -e consumes the rest of argv as the command to run.
    await execBinary("open", [
      "-na",
      `${TERMINAL_APP}.app`,
      "--args",
      "-e",
      command,
    ]);
    return;
  }

  // Ghostty already running: activate it, open a new window, type the command.
  // AppleScript string literals need " and \ escaped.
  const escaped = command.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `
    tell application "${TERMINAL_APP}" to activate
    delay 0.15
    tell application "System Events"
      keystroke "n" using command down
      delay 0.25
      keystroke "${escaped}"
      key code 36
    end tell
  `;
  await execBinary("osascript", ["-e", script]);
}
