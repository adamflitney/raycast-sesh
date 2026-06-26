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
  getMostRecentClient,
  createSession,
  switchClient,
  sanitizeSessionName,
  ensureSessionWindows,
} from "./lib/tmux";
import { focusTerminal } from "./lib/terminal";
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

export default function ReplaceSession() {
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
      const clients = await listClients();
      const client = getMostRecentClient(clients);

      if (!client) {
        await showToast({
          style: Toast.Style.Failure,
          title: "No active tmux session",
          message: "Open a tmux session in Ghostty first",
        });
        return;
      }

      await showToast({
        style: Toast.Style.Animated,
        title: `Switching to ${item.name}...`,
      });

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

      await switchClient(item.sessionName, client.tty);
      await focusTerminal();

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
                    item.isActive ? "Replace with Session" : "Create and Replace"
                  }
                  icon={Icon.ArrowRight}
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
