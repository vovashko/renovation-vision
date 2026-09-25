import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/profile-form";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — RenoTrack Manager" },
      { name: "description", content: "Your name, photo, email and password." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader title="Settings" description="Your profile and sign-in details." />
      <div className="mt-6 max-w-2xl">
        <ProfileForm />
      </div>
    </div>
  );
}
