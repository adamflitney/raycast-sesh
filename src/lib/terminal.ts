import { execBinary } from "./exec";

const TERMINAL_APP = "Ghostty";

export async function focusTerminal(): Promise<void> {
  await execBinary("osascript", [
    "-e",
    `tell application "${TERMINAL_APP}" to activate`,
  ]);
}

/**
 * Searches all tabs in the front Ghostty window for one whose title starts with
 * "<sessionName>:" (tmux propagates titles as "session: window"). If found,
 * selects that tab and brings Ghostty to the front. Returns true on success.
 */
export async function focusSessionTab(sessionName: string): Promise<boolean> {
  const script = `
    tell application "${TERMINAL_APP}"
      set w to front window
      repeat with t in every tab of w
        if name of t starts with "${sessionName}:" or name of t is "${sessionName}" then
          select tab t
          activate window w
          activate
          return true
        end if
      end repeat
      return false
    end tell
  `;
  try {
    const result = await execBinary("osascript", ["-e", script]);
    return result.trim() === "true";
  } catch {
    return false;
  }
}

/**
 * Opens a new tab in the front Ghostty window (or launches Ghostty if it isn't
 * running) and attaches to the given tmux session. Uses the native AppleScript
 * "new tab" command with a surface configuration so no keystrokes are needed.
 */
export async function openNewTabForSession(sessionName: string): Promise<void> {
  const script = `
    tell application "${TERMINAL_APP}"
      if (count of windows) is 0 then
        set cfg to new surface configuration
        set command of cfg to "tmux attach -t ${sessionName}"
        new window with configuration cfg
      else
        set cfg to new surface configuration
        set command of cfg to "tmux attach -t ${sessionName}"
        new tab in front window with configuration cfg
      end if
      activate
    end tell
  `;
  await execBinary("osascript", ["-e", script]);
}
