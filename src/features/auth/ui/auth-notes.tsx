import { useTranslation } from "react-i18next";
import { Note } from "@/components/ui/note";
import type { AuthErrorKey } from "../domain/auth-errors";

/** A failed auth call, translated (never Supabase's English message). Renders nothing without an error. */
export function AuthErrorNote({ errorKey, className }: { errorKey: AuthErrorKey | null | undefined; className?: string }) {
  const { t } = useTranslation(["auth"]);
  if (!errorKey) return null;
  return (
    <Note tone="error" className={className}>
      {t(errorKey)}
    </Note>
  );
}

/** A confirmation (link sent, password changed). */
export function AuthSuccessNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Note tone="success" className={className}>
      {children}
    </Note>
  );
}
