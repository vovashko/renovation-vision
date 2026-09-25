import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Renovision Manager" },
      { name: "description", content: "App settings." },
    ],
  }),
  component: SettingsPage,
});

// No settings yet; your profile is edited from the avatar at the bottom of the menu.
function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader title="Settings" />
    </div>
  );
}
