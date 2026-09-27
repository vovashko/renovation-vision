import { useCallback, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmContext, type Confirm, type ConfirmOptions } from "./use-confirm";

type ConfirmDialogProps = ConfirmOptions & {
  open: boolean;
  /** Called with `true` on confirm, `false` on cancel, Escape or an outside click. */
  onResult: (confirmed: boolean) => void;
};

/** A controlled yes/no dialog. Most call sites want `useConfirm()` instead. */
export function ConfirmDialog({ open, onResult, title, description, confirmLabel, cancelLabel, destructive }: ConfirmDialogProps) {
  const { t } = useTranslation(["common"]);
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onResult(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t("common:confirm.title")}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onResult(false)}>{cancelLabel ?? t("common:confirm.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? buttonVariants({ variant: "destructive" }) : undefined}
            onClick={() => onResult(true)}
          >
            {confirmLabel ?? t("common:confirm.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type Pending = { resolve: (confirmed: boolean) => void };

/** Renders the one app-wide confirm dialog behind `useConfirm()`. Mounted once in `__root.tsx`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // The last options stay rendered while the dialog animates closed.
  const [options, setOptions] = useState<ConfirmOptions>({});
  const pending = useRef<Pending | null>(null);

  const confirm = useCallback<Confirm>((next = {}) => {
    // A second confirm while one is open answers the first with "no".
    pending.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      pending.current = { resolve };
      setOptions(next);
      setOpen(true);
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    pending.current?.resolve(confirmed);
    pending.current = null;
    setOpen(false);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog open={open} onResult={settle} {...options} />
    </ConfirmContext.Provider>
  );
}
