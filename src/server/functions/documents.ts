// Atomic document delete: remove the DB row, then the storage object, so a client never makes two calls (and
// risks orphaning the file when the second fails). Manager-only (requireProjectRole("manager")); context.supabase
// acts as the user, so RLS applies exactly as from the browser. Handler body: documents.server.ts.
import { z } from "zod";
import { authedFn } from "../fn";
import { requireProjectRole } from "../middleware/auth";
import { deleteDocumentHandler } from "./documents.server";

const deleteDocumentInput = z.object({ projectId: z.string().uuid(), documentId: z.string().uuid() });

export const deleteDocument = authedFn({ method: "POST" })
  .middleware([requireProjectRole((input: { projectId: string }) => input.projectId, "manager")])
  .validator(deleteDocumentInput)
  .handler(async ({ data, context }) => deleteDocumentHandler(data, context));
