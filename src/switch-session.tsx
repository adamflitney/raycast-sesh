import { useEffect, useState, useCallback } from "react";
import {
  List,
  ActionPanel,
  Action,
  Icon,
  Color,
  showToast,
  Toast,
  closeMainWindow,
  popToRoot,
} from "@raycast/api";
import { getProjectDirectories } from "./lib/config";
import { findGitProjects } from "./lib/projects";
import { scoreProjects, ScoredProject } from "./lib/scoring";
import {
  listSessions,
  listClients,
  createSession,
  sanitizeSessionName,
  ensureSessionWindows,
} from "./lib/tmux";
import { focusSessionTab, openNewTabForSession } from "./lib/terminal";
import { addRecent } from "./lib/cache";
import { homedir } from "os";

interface SessionItem extends ScoredProject {
  sessionName: string;
  isActive: boolean;
}

function shortenPath(path: string): string {
  const home = homedir();
  if (path.startsWith(home)) {
    return "~" + path.slice(home.length);
  }
  return path;
}

export default function SwitchSession() {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sessions, dirs] = await Promise.all([
        listSessions(),
        getProjectDirectories(),
      ]);

      const activeSet = new Set(sessions);
      const projects = await findGitProjects(dirs);
      const scored = await scoreProjects(projects);

      const sessionItems: SessionItem[] = scored.map((project) => {
        const sessionName = sanitizeSessionName(project.name);
        return {
          ...project,
          sessionName,
          isActive: activeSet.has(sessionName),
        };
      });

      // Add any active sessions that don't match a discovered project.
      // Skip tmux's auto-named numeric sessions ("0", "1", ...) — those are
      // throwaway sessions tmux creates when started without -s, and they
      // tend to clutter the list without representing real work.
      for (const session of sessions) {
        if (/^\d+$/.test(session)) continue;
        const alreadyListed = sessionItems.some(
          (item) => item.sessionName === session,
        );
        if (!alreadyListed) {
          sessionItems.unshift({
            name: session,
            path: "",
            score: Infinity,
            sessionName: session,
            isActive: true,
          });
        }
      }

      setItems(sessionItems);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load projects",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelect = useCallback(async (item: SessionItem) => {
    try {
      await showToast({
        style: Toast.Style.Animated,
        title: `Switching to ${item.name}...`,
      });

      // Create session if it doesn't exist. If it already exists, top up any
      // missing default windows so older sessions match the 3-window layout.
      if (!item.isActive) {
        if (!item.path) {
          await showToast({
            style: Toast.Style.Failure,
            title: "Cannot create session",
            message: "No project path available",
          });
          return;
        }
        await createSession(item.sessionName, item.path);
      } else {
        await ensureSessionWindows(item.sessionName, item.path);
      }

      // If the session already has a client attached, its tab is open somewhere
      // in Ghostty — find it by name and bring it forward. Otherwise open a
      // new tab and attach.
      const clients = await listClients();
      const hasClient = clients.some((c) => c.session === item.sessionName);

      if (hasClient) {
        await focusSessionTab(item.sessionName);
      } else {
        await openNewTabForSession(item.sessionName);
      }

      // Update frecency tracking
      if (item.path) {
        await addRecent(item.name, item.path);
      }

      await closeMainWindow();
      await popToRoot();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to switch session",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, []);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search projects...">
      {items.length === 0 && !isLoading ? (
        <List.EmptyView
          title="No Projects Found"
          description="Check your sesh config at ~/.config/sesh/config.yaml"
          icon={Icon.Folder}
        />
      ) : (
        items.map((item) => (
          <List.Item
            key={item.sessionName}
            title={item.name}
            subtitle={item.path ? shortenPath(item.path) : undefined}
            icon={item.isActive ? Icon.Terminal : Icon.Folder}
            accessories={
              item.isActive
                ? [{ tag: { value: "active", color: Color.Green } }]
                : []
            }
            actions={
              <ActionPanel>
                <Action
                  title={
                    item.isActive ? "Switch to Session" : "Create and Switch"
                  }
                  icon={Icon.Terminal}
                  onAction={() => handleSelect(item)}
                />
                {item.path && (
                  <Action.CopyToClipboard
                    title="Copy Path"
                    content={item.path}
                    shortcut={{ modifiers: ["cmd"], key: "c" }}
                  />
                )}
                <Action
                  title="Refresh"
                  icon={Icon.RotateClockwise}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                  onAction={loadData}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
