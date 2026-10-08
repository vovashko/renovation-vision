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
  documents: (id: string) => ["documents", id] as const,
  expenses: (id: string) => ["expenses", id] as const,
  messages: (id: string) => ["messages", id] as const,
  notifications: (id: string) => ["notifications", id] as const,
  activity: (id: string) => ["activity", id] as const,
  knowledge: (id: string) => ["knowledge", id] as const,
  /** A project's investor decisions; the keys below nest under it, so invalidating this refreshes all of them. */
  decisions: (id: string) => ["decisions", id] as const,
  /** How many of the project's decisions are pending (the navigation badge). */
  decisionCount: (id: string) => ["decisions", id, "count"] as const,
  /** One decision's history. */
  decisionEvents: (id: string, decisionId: string) => ["decisions", id, "events", decisionId] as const,
  /** A project's contacts (crew, client, PoC…) as its managers see them. */
  projectContacts: (id: string) => ["projectContacts", id] as const,
  /** A project's client-visible contacts (`project_visible_contacts`), for any member. */
  visibleContacts: (id: string) => ["visibleContacts", id] as const,
  /** The signed-in user as the server sees them (`getMe`), per user id. */
  me: (userId: string) => ["me", userId] as const,
};
