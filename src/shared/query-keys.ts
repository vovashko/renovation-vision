/**
 * TanStack Query cache keys, shared across every feature so cross-feature invalidation keeps
 * working (e.g. the work and budget features both invalidate `project`/`projects`/`activity`/
 * `notifications`, which the project overview and other features read). Keep the shapes here
 * identical to what's already cached — changing one is a breaking change for every feature's
 * `invalidate` list.
 */
export const keys = {
  projects: ["projects"] as const,
  project: (id: string) => ["project", id] as const,
  internal: (id: string) => ["internal", id] as const,
  members: (id: string) => ["members", id] as const,
  stages: (id: string) => ["stages", id] as const,
  rooms: (id: string) => ["rooms", id] as const,
  photos: (id: string) => ["photos", id] as const,
  renders: (id: string) => ["renders", id] as const,
  expenses: (id: string) => ["expenses", id] as const,
  messages: (id: string) => ["messages", id] as const,
  notifications: (id: string) => ["notifications", id] as const,
  activity: (id: string) => ["activity", id] as const,
  knowledge: (id: string) => ["knowledge", id] as const,
  crew: (id: string) => ["crew", id] as const,
  /** The signed-in user as the server sees them (`getMe`), per user id. */
  me: (userId: string) => ["me", userId] as const,
};
