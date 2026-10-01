// Atomic deletes for photos and design renders: delete the DB row, then remove the storage object,
// so a client never has to make two calls (and risk orphaning the object when the second fails).
// Manager-only (requireProjectRole("manager")); context.supabase acts as the user, so RLS applies
// exactly as it does from the browser. Handler bodies live in media.server.ts (unit-tested directly,
// the same pattern as functions/me.ts + me.server.ts). See README → Server functions & security.
import { z } from "zod";
import { authedFn } from "../fn";
import { requireProjectRole } from "../middleware/auth";
import { deletePhotoHandler, deleteRenderHandler } from "./media.server";

const deletePhotoInput = z.object({ projectId: z.string().uuid(), photoId: z.string().uuid() });

export const deletePhoto = authedFn({ method: "POST" })
  .middleware([requireProjectRole((input: { projectId: string }) => input.projectId, "manager")])
  .validator(deletePhotoInput)
  .handler(async ({ data, context }) => deletePhotoHandler(data, context));

const deleteRenderInput = z.object({ projectId: z.string().uuid(), renderId: z.string().uuid() });

export const deleteRender = authedFn({ method: "POST" })
  .middleware([requireProjectRole((input: { projectId: string }) => input.projectId, "manager")])
  .validator(deleteRenderInput)
  .handler(async ({ data, context }) => deleteRenderHandler(data, context));
