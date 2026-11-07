// Settings → Security's email change (T70): the account's email and pending change, and starting one.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { emailRepo } from "../data/email.repo";

export type { AccountEmail } from "../data/email.repo";

export const emailKeys = { account: (userId: string) => ["accountEmail", userId] as const };

/** The login email and the address waiting for confirmation, if any. */
export function useAccountEmail() {
  const { status, userId } = useAuth();
  return useQuery({
    queryKey: emailKeys.account(userId ?? ""),
    queryFn: () => emailRepo.current(),
    enabled: status === "signed-in" && !!userId,
    retry: false,
  });
}

/** Asks for the change (both addresses get a confirmation link), then re-reads the pending state. */
export function useRequestEmailChange() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => emailRepo.requestChange(email),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: emailKeys.account(userId ?? "") }),
  });
}
