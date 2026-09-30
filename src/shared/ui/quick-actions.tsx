import { useParams, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TabBarRow } from "@/components/ui/tab-bar";
import { UploadSheet } from "@/features/media/ui/photo-upload-sheet";
import { ExpenseSheet } from "@/features/budget/ui/expense-sheet";
import { useRooms, useStages } from "@/features/work/hooks";
import { useNavRole } from "@/shared/ui/nav-role";
import { projectPath } from "@/shared/ui/nav-config";

/**
 * Manager-only phone FAB, sitting above the bottom bar (`bottom-nav.tsx`). Actions are a plain list
 * so a later "Diary entry" action just slots in; today it's "Upload photo" (camera-first) and
 * "Add expense", each opening the same sheet the Photos/Budget pages use.
 */
export function QuickActions() {
  const role = useNavRole();
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const path = useRouterState({ select: (r) => r.location.pathname });

  // Managers only, inside a project, and never on the chat page (the FAB would sit over the composer).
  if (role !== "manager" || !projectId) return null;
  if (path.replace(/\/$/, "") === projectPath(projectId, "chat")) return null;

  return <QuickActionsPanel projectId={projectId} />;
}

function QuickActionsPanel({ projectId }: { projectId: string }) {
  const { t } = useTranslation(["common"]);
  const { data: stages = [] } = useStages(projectId);
  const { data: rooms = [] } = useRooms(projectId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const openMenu = () => setMenuOpen(true);
  const openUpload = () => {
    setMenuOpen(false);
    setUploadOpen(true);
  };
  const openExpense = () => {
    setMenuOpen(false);
    setExpenseOpen(true);
  };
  const closeExpense = () => setExpenseOpen(false);
  // ExpenseSheet's `expense` prop doubles as its open flag ("new" | an Expense to edit | closed);
  // computed here, outside JSX, alongside the rest of this panel's plain state.
  const expenseValue = expenseOpen ? "new" : null;

  return (
    <>
      <Button size="fab" aria-label={t("quickActions.label")} aria-haspopup="dialog" onClick={openMenu}>
        <Icon name="add" size={24} />
      </Button>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="bottom" className="gap-2 bg-surface-container-low px-3">
          <SheetHeader>
            <SheetTitle>{t("quickActions.label")}</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1 px-1 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <TabBarRow icon="add_a_photo" onClick={openUpload}>
              {t("quickActions.uploadPhoto")}
            </TabBarRow>
            <TabBarRow icon="receipt_long" onClick={openExpense}>
              {t("quickActions.addExpense")}
            </TabBarRow>
          </div>
        </SheetContent>
      </Sheet>
      <UploadSheet projectId={projectId} open={uploadOpen} onOpenChange={setUploadOpen} stages={stages} rooms={rooms} capture />
      <ExpenseSheet projectId={projectId} expense={expenseValue} stages={stages} onClose={closeExpense} />
    </>
  );
}
