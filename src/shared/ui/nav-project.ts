import { useParams, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

const KEY = "renovision:last-project";

type Remembered = { userId: string; projectId: string };

function read(): Remembered | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Remembered) : null;
  } catch {
    return null;
  }
}

function write(value: Remembered) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Storage can be blocked (private windows); the nav just falls back to the plain /settings view.
  }
}

/**
 * The project the navigation is for. Inside a project that is the route's `projectId`. Settings lives
 * outside the project routes, so on /settings the last project this user had open (kept in sessionStorage,
 * per user) stays in the rail and phone bar: opening Settings does not drop you out of the project.
 */
export function useNavProjectId(): string | undefined {
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const onSettings = useRouterState({ select: (r) => r.location.pathname.startsWith("/settings") });
  const userId = useAuth().userId;
  const [remembered, setRemembered] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    if (projectId) {
      write({ userId, projectId });
      return;
    }
    const last = read();
    setRemembered(last && last.userId === userId ? last.projectId : undefined);
  }, [projectId, userId, onSettings]);

  if (projectId) return projectId;
  return onSettings ? remembered : undefined;
}
