import { createContext, useContext } from "react";

export type ConfirmOptions = {
  /** The question, already translated ("Delete this photo?"). Defaults to `common:confirm.title`. */
  title?: string;
  /** Consequences, one or two sentences. */
  description?: string;
  /** Confirm button label. Defaults to `common:confirm.confirm`. */
  confirmLabel?: string;
  /** Cancel button label. Defaults to `common:confirm.cancel`. */
  cancelLabel?: string;
  /** Red confirm button, for deletes and removals. */
  destructive?: boolean;
};

export type Confirm = (options?: ConfirmOptions) => Promise<boolean>;

/** Provided by `<ConfirmProvider>` (confirm-dialog.tsx), mounted once in `__root.tsx`. */
export const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Promise-based replacement for `window.confirm()`:
 *
 *   const confirm = useConfirm();
 *   onClick={async () => (await confirm({ title: t("media:deleteConfirm"), destructive: true })) && remove.mutate(photo)}
 *
 * Resolves `true` on confirm and `false` on cancel, Escape or an outside click.
 */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm() needs <ConfirmProvider> above it (mounted in __root.tsx).");
  return confirm;
}
