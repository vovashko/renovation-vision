import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Settings — RenoVision" }, { name: "description", content: "App settings." }],
  }),
  component: SettingsPage,
});

// No settings yet; your profile is edited from the avatar pinned at the bottom of the nav rail.
function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader title="Settings" />
    </div>
  );
}
