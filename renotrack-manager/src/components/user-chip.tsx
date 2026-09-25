import { Link } from "@tanstack/react-router";
import { initials } from "@/components/ui/chat";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Round profile photo, or initials when there is none. */
export function UserAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return src ? (
    <img src={src} alt="" className={cn("size-9 shrink-0 rounded-full object-cover", className)} />
  ) : (
    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full bg-primary-container text-label-lg text-on-primary-container", className)}>
      {initials(name || "?")}
    </span>
  );
}

/** Avatar + full name in a light pill; opens Settings. */
export function UserChip({ className }: { className?: string }) {
  const { profile } = useAuth();
  const name = profile?.full_name ?? "";
  return (
    <Link
      to="/settings"
      aria-label={`${name || "Your profile"}: open settings`}
      className={cn(
        "state-layer inline-flex h-11 max-w-full items-center gap-2.5 rounded-full border border-outline-variant bg-surface-container-lowest py-1 pr-4 pl-1 text-label-lg text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      <UserAvatar name={name} src={profile?.avatar_url} />
      <span className="truncate">{name}</span>
    </Link>
  );
}
