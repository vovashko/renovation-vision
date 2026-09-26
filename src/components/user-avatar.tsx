import { initials } from "@/components/chat";
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
