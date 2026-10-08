import type { MaterialStatus } from "./materials";

/**
 * Whether an investor warning ("Uwaga do inwestora") is still shown. It is a risk note, never a date change.
 *
 * The rule: a warning is open while ANY linked material is not yet delivered or installed (`planned` or
 * `ordered`). A warning with no linked material stays open until the manager removes it. The database applies
 * the same rule to what clients may read (`private.warning_is_open`); managers always see every warning and use
 * this to mark the resolved ones.
 */
export function isWarningOpen(linkedStatuses: readonly MaterialStatus[]): boolean {
  if (linkedStatuses.length === 0) return true;
  return linkedStatuses.some((s) => s === "planned" || s === "ordered");
}
