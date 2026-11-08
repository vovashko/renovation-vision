import type { Database } from "./db.types";

/** `planned` (not ordered yet) · `ordered` · `delivered` · `installed`. */
export type MaterialStatus = Database["public"]["Enums"]["material_status"];

/** Every material status, in the order a material moves through them (forms, pickers). */
export const materialStatuses: MaterialStatus[] = ["planned", "ordered", "delivered", "installed"];

/** Traffic-light colour of a material in the room view: red = not ordered, orange = on its way, green = on site. */
export type MaterialTone = "red" | "orange" | "green";

export function materialTone(status: MaterialStatus): MaterialTone {
  switch (status) {
    case "planned":
      return "red";
    case "ordered":
      return "orange";
    case "delivered":
    case "installed":
      return "green";
  }
}

export type MaterialDateInfo =
  /** Not ordered yet: order at the latest by this date. */
  | { kind: "orderBy"; date: string }
  /** Ordered: delivery expected on this date. */
  | { kind: "delivery"; date: string }
  /** Delivered or installed: it arrived on this date. */
  | { kind: "delivered"; date: string };

/**
 * The date a material row shows next to its status, or null when the relevant date isn't known:
 * `planned` → order-by date ("najpóźniej zamówić do …"), `ordered` → expected delivery ("dostawa …"),
 * `delivered`/`installed` → the delivery date. Dates are `YYYY-MM-DD` strings, formatted by the UI.
 */
export function materialDateInfo(m: {
  status: MaterialStatus;
  order_by_date: string | null;
  delivery_date: string | null;
}): MaterialDateInfo | null {
  switch (m.status) {
    case "planned":
      return m.order_by_date ? { kind: "orderBy", date: m.order_by_date } : null;
    case "ordered":
      return m.delivery_date ? { kind: "delivery", date: m.delivery_date } : null;
    case "delivered":
    case "installed":
      return m.delivery_date ? { kind: "delivered", date: m.delivery_date } : null;
  }
}

/** A material's price tag in cents-rounded money: quantity × unit price. */
export function materialTotal(m: { quantity: number; unit_price: number }): number {
  return Math.round(m.quantity * m.unit_price * 100) / 100;
}

/** The expense a delivered material creates by default (editable before saving). Null when there is nothing to charge. */
export function deliveredExpenseAmount(m: { quantity: number; unit_price: number }): number | null {
  const total = materialTotal(m);
  return total > 0 ? total : null;
}

/** A material that already has an expense must not get a second one (the database refuses it too). */
export const canCreateExpense = (m: { expense_id: string | null }): boolean => m.expense_id === null;
