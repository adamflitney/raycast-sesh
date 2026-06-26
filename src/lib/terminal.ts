import { execBinary, execCommand } from "./exec";

const TERMINAL_APP = "Ghostty";

export async function focusTerminal(): Promise<void> {
  await execBinary("osascript", [
    "-e",
    `tell application "${TERMINAL_APP}" to activate`,
  ]);
}

async function isGhosttyRunning(): Promise<boolean> {
  try {
    await execCommand(`pgrep -xi ${TERMINAL_APP}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Searches all tabs across all Ghostty windows for one whose title starts with
 * "<sessionName>:" (tmux propagates titles as "session: window"). If found,
 * brings that window and tab to the front. Returns true on success.
 */
export async function focusSessionTab(sessionName: string): Promise<boolean> {
  const script = `
    tell application "${TERMINAL_APP}"
      activate
      repeat with w in every window
        repeat with t in every tab of w
          if name of t starts with "${sessionName}:" or name of t is "${sessionName}" then
            activate window w
            select tab t
            return "found"
          end if
        end repeat
      end repeat
      return "notfound"
    end tell
  `;
  try {
    const result = await execBinary("osascript", ["-e", script]);
    return result.trim() === "found";
  } catch {
    return false;
  }
}

/**
 * Opens a new Ghostty tab and attaches to the given tmux session.
 *
 * Uses Ghostty's native AppleScript API (no System Events / Accessibility
 * permissions required). A literal newline at the end of `input text` acts as
 * Enter to execute the command. We unset TMUX/TMUX_PANE first so tmux treats
 * this as a fresh attach rather than a switch-client (Ghostty inherits TMUX
 * from the environment it was launched in).
 */
export async function openNewTabForSession(sessionName: string): Promise<void> {
  const running = await isGhosttyRunning();

  if (!running) {
    const command = `unset TMUX TMUX_PANE; exec tmux attach -t ${sessionName}`;
    await execBinary("open", ["-na", `${TERMINAL_APP}.app`, "--args", "-e", command]);
    return;
  }

  const script = `
    tell application "${TERMINAL_APP}"
      activate
      set newTab to new tab in front window
      delay 0.4
      set term to focused terminal of newTab
      input text "unset TMUX TMUX_PANE; exec tmux attach -t ${sessionName}" to term
      send key "enter" to term
    end tell
  `;
  await execBinary("osascript", ["-e", script]);
}
