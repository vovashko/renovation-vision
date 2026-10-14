// Server function for the spreadsheet import (T45). The handler body lives in import.server.ts.
//
//   importRows   manager: imports stages (+ tasks) or materials through the all-or-nothing RPCs
//
// The browser parses the file and validates every cell; the server re-validates the shape and the RPC
// validates again against the project (rooms, stages, suppliers). Contacts import is deferred to T46.
import { z } from "zod";
import { authedFn } from "../fn";
import { requireProjectRole } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { importRowsHandler } from "./import.server";

const cell = (max: number) => z.string().max(max);

const stageRow = z.object({
  name: cell(160),
  start_date: cell(10),
  end_date: cell(10),
  client_note: cell(2000),
  tasks: z.array(z.object({ name: cell(200), room: cell(120) })).max(500),
});

const materialRow = z.object({
  name: cell(200),
  quantity: z.number().finite().nullable(),
  unit: cell(16),
  unit_price: z.number().finite().nullable(),
  status: cell(16),
  stage: cell(160),
  room: cell(120),
  supplier: cell(160),
  notes: cell(2000),
});

const importInput = z.discriminatedUnion("kind", [
  z.object({ projectId: z.string().uuid(), kind: z.literal("stages"), rows: z.array(stageRow).min(1).max(500) }),
  z.object({ projectId: z.string().uuid(), kind: z.literal("materials"), rows: z.array(materialRow).min(1).max(2000) }),
]);

export const importRows = authedFn({ method: "POST" })
  .middleware([requireProjectRole((input: { projectId: string }) => input.projectId, "manager"), rateLimit({ key: "default" })])
  .validator(importInput)
  .handler(async ({ data, context }) => importRowsHandler(data, context));
