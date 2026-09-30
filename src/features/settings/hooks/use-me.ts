import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getMe } from "@/server/functions/me";
import { keys } from "@/shared/query-keys";

/**
 * The signed-in user as the server sees them: `{ id, email, aal, accountType }` from the `getMe`
 * server function (Bearer token → requireUser → a profiles query as the user).
 */
export function useMe() {
  const { status, userId } = useAuth();
  return useQuery({
    queryKey: keys.me(userId ?? ""),
    queryFn: () => getMe(),
    enabled: status === "signed-in" && !!userId,
    staleTime: 60_000,
    retry: false,
  });
}
