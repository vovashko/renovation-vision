import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";

const DEMO_HINT = import.meta.env.VITE_DEMO_HINT === "true";

// Fixed seed credentials (see README → Local Supabase), not UI copy and not a config fallback: the
// hosted demo publishes them on purpose, and only when VITE_DEMO_HINT=true.
const DEMO_ACCOUNTS = {
  managerEmail: "jonas@renovision.demo",
  clientEmail: "sarah@renovision.demo",
  password: "renovision-demo",
};

function DemoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** Demo credentials under the sign-in form, only when VITE_DEMO_HINT=true (hosted demo, local dev). */
export function DemoHint() {
  const { t } = useTranslation(["auth"]);
  if (!DEMO_HINT) return null;
  return (
    <Card variant="tinted" className="p-4">
      <p className="text-label-sm font-medium text-on-surface-variant uppercase">{t("demoHint.heading")}</p>
      <dl className="mt-2 space-y-1 text-body-sm text-on-surface">
        <DemoRow label={t("demoHint.manager")} value={DEMO_ACCOUNTS.managerEmail} />
        <DemoRow label={t("demoHint.client")} value={DEMO_ACCOUNTS.clientEmail} />
        <DemoRow label={t("demoHint.password")} value={DEMO_ACCOUNTS.password} />
      </dl>
    </Card>
  );
}
