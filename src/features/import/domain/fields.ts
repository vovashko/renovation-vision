// The importable columns of each kind and the header names (English and Polish) that map to them
// automatically. Aliases are compared after `normalizeHeader`.
import type { ImportKind } from "./types";

export type FieldDef = { key: string; required: boolean; aliases: string[] };

export const STAGE_FIELDS: FieldDef[] = [
  { key: "name", required: true, aliases: ["stage", "stage name", "name", "etap", "nazwa etapu", "nazwa"] },
  { key: "start_date", required: true, aliases: ["start", "start date", "from", "data rozpoczecia", "rozpoczecie", "poczatek", "od"] },
  { key: "end_date", required: true, aliases: ["end", "end date", "to", "finish", "data zakonczenia", "zakonczenie", "koniec", "do"] },
  { key: "client_note", required: false, aliases: ["client note", "note", "notes", "notatka dla klienta", "notatka", "uwagi"] },
  { key: "task", required: false, aliases: ["task", "tasks", "zadanie", "zadania"] },
  { key: "room", required: false, aliases: ["room", "pokoj", "pomieszczenie"] },
];

export const MATERIAL_FIELDS: FieldDef[] = [
  { key: "name", required: true, aliases: ["material", "name", "item", "nazwa", "nazwa materialu"] },
  { key: "quantity", required: false, aliases: ["quantity", "qty", "amount", "ilosc", "liczba"] },
  { key: "unit", required: false, aliases: ["unit", "uom", "jednostka", "jm", "j m"] },
  {
    key: "unit_price",
    required: false,
    aliases: ["unit price", "price", "cost", "cena jednostkowa", "cena", "cena jedn", "cena za jednostke"],
  },
  { key: "status", required: false, aliases: ["status", "stan"] },
  { key: "stage", required: false, aliases: ["stage", "etap"] },
  { key: "room", required: false, aliases: ["room", "pokoj", "pomieszczenie"] },
  { key: "supplier", required: false, aliases: ["supplier", "vendor", "dostawca", "sklep"] },
  { key: "notes", required: false, aliases: ["notes", "note", "uwagi", "notatki", "notatka"] },
];

export const CONTACT_FIELDS: FieldDef[] = [
  {
    key: "full_name",
    required: true,
    aliases: ["name", "full name", "contact", "contact name", "imie i nazwisko", "imie nazwisko", "nazwisko", "nazwa", "kontakt"],
  },
  { key: "kind", required: false, aliases: ["kind", "type", "category", "rodzaj", "typ", "kategoria"] },
  { key: "company", required: false, aliases: ["company", "firm", "organisation", "organization", "firma", "spolka"] },
  {
    key: "trade",
    required: false,
    aliases: ["trade", "role", "specialty", "speciality", "profession", "branza", "specjalizacja", "zawod", "rola", "fach"],
  },
  { key: "phone", required: false, aliases: ["phone", "telephone", "mobile", "tel", "telefon", "numer telefonu", "komorka"] },
  { key: "whatsapp", required: false, aliases: ["whatsapp", "whats app", "wa"] },
  { key: "email", required: false, aliases: ["email", "e mail", "mail", "email address", "adres email", "adres e mail"] },
  { key: "notes", required: false, aliases: ["notes", "note", "uwagi", "notatki", "notatka", "komentarz"] },
];

export const FIELDS: Record<ImportKind, FieldDef[]> = { stages: STAGE_FIELDS, materials: MATERIAL_FIELDS, contacts: CONTACT_FIELDS };
