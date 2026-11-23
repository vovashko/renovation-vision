// Server function for the spreadsheet import (T45). The handler body lives in import.server.ts.
//
//   importRows      manager: imports stages (+ tasks) or materials through the all-or-nothing RPCs
//   importContacts  staff: imports contacts into the address book through public.import_contacts
//
// The browser parses the file and validates every cell; the server re-validates the shape and the RPC
// validates again against the project (rooms, stages, suppliers). Contacts (T46) are company-wide: importContacts is
// staff-only and has no project.
import { z } from "zod";
import { authedFn } from "../fn";
import { requireProjectRole, requireStaff } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { importContactsHandler, importRowsHandler } from "./import.server";

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

const contactRow = z.object({
  full_name: cell(160),
  kind: cell(16),
  company: cell(160),
  trade: cell(120),
  phone: cell(20),
  whatsapp: cell(20),
  email: cell(254),
  notes: cell(2000),
});

export const importContacts = authedFn({ method: "POST" })
  .middleware([requireStaff, rateLimit({ key: "default" })])
  .validator(z.object({ rows: z.array(contactRow).min(1).max(1000) }))
  .handler(async ({ data, context }) => importContactsHandler(data, context));
