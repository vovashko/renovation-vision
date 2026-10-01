// The work feature's hooks entry point: other features and routes import stages/rooms/mutations
// from here (README → Architecture: cross-feature imports go through hooks/domain, never data/).
// `useProject` belongs to `@/features/projects/hooks` — work only owns stages, tasks and rooms.
export { useStages, useRooms, stagesQuery, roomsQuery } from "./queries";
export { useSaveStage, useDeleteStage, useSaveTask, useDeleteTask, useSaveRoom, useDeleteRoom } from "./mutations";
