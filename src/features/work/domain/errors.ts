// Recognizes the raw messages Postgres triggers raise for stage/room/task rules (see
// supabase/migrations/*_functions_triggers.sql) and maps them to an i18n key + params, so mutation
// hooks can show a translated toast. An unrecognized message is returned as-is (`null` key).

const ROOM_DONE_TASKS_OPEN = /^(.+) cannot be marked Completed while tasks are open: (.+)$/;
const ROOM_DONE_REOPEN_TASK = "Room is marked Completed — change its status before adding or re-opening tasks";

export type KnownWorkError = { key: `work:errors.${string}`; params?: Record<string, string> };

/** Matches a raw Postgres error message against the known stage/room/task trigger errors. */
export function matchWorkError(message: string): KnownWorkError | null {
  const roomTasksOpen = ROOM_DONE_TASKS_OPEN.exec(message);
  if (roomTasksOpen) return { key: "work:errors.roomDoneTasksOpen", params: { name: roomTasksOpen[1], tasks: roomTasksOpen[2] } };
  if (message === ROOM_DONE_REOPEN_TASK) return { key: "work:errors.roomDoneReopenTask" };
  return null;
}

/** `translateWorkError(t, error)` — the translated message when known, otherwise the raw message. */
export function translateWorkError(t: (key: string, params?: Record<string, string>) => string, error: Error): string {
  const known = matchWorkError(error.message);
  return known ? t(known.key, known.params) : error.message;
}
