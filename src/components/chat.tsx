import { AvatarInitials } from "@/components/ui/avatar-initials";

// `initials` and `ChatAvatar` are kept here (rather than moved into `src/features/comms/ui/`)
// because other, not-yet-reworked pages still import them from this path: `user-avatar.tsx`
// (`initials`) and `team.tsx` (`ChatAvatar`). The rest of the former chat UI lives in
// `src/features/comms/ui/` and `src/components/ui/chat-bubble.tsx`.

export function initials(name: string) {
  const words = name.split(" ").filter((w) => /^[a-z]/i.test(w));
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

export function ChatAvatar({ name, className }: { name: string; className?: string }) {
  return <AvatarInitials initials={initials(name)} className={className} />;
}
