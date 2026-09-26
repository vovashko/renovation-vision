import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "./api";

export const keys = {
  projects: ["projects"] as const,
  project: (id: string) => ["project", id] as const,
  internal: (id: string) => ["internal", id] as const,
  members: (id: string) => ["members", id] as const,
  stages: (id: string) => ["stages", id] as const,
  rooms: (id: string) => ["rooms", id] as const,
  photos: (id: string) => ["photos", id] as const,
  renders: (id: string) => ["renders", id] as const,
  expenses: (id: string) => ["expenses", id] as const,
  messages: (id: string) => ["messages", id] as const,
  notifications: (id: string) => ["notifications", id] as const,
  activity: (id: string) => ["activity", id] as const,
  knowledge: (id: string) => ["knowledge", id] as const,
  crew: (id: string) => ["crew", id] as const,
};

export const useProjects = () => useQuery({ queryKey: keys.projects, queryFn: api.listProjects });
export const useProject = (id: string | undefined) =>
  useQuery({ queryKey: keys.project(id ?? ""), queryFn: () => api.getProject(id!), enabled: !!id });
export const useInternal = (id: string) => useQuery({ queryKey: keys.internal(id), queryFn: () => api.getInternal(id) });
export const useMembers = (id: string) => useQuery({ queryKey: keys.members(id), queryFn: () => api.listMembers(id) });
export const useStages = (id: string) => useQuery({ queryKey: keys.stages(id), queryFn: () => api.listStages(id) });
export const useRooms = (id: string) => useQuery({ queryKey: keys.rooms(id), queryFn: () => api.listRooms(id) });
export const usePhotos = (id: string) =>
  useQuery({ queryKey: keys.photos(id), queryFn: () => api.listPhotos(id), staleTime: 30 * 60 * 1000 });
export const useRenders = (id: string) =>
  useQuery({ queryKey: keys.renders(id), queryFn: () => api.listRenders(id), staleTime: 30 * 60 * 1000 });
export const useExpenses = (id: string) => useQuery({ queryKey: keys.expenses(id), queryFn: () => api.listExpenses(id) });
export const useMessages = (id: string) => useQuery({ queryKey: keys.messages(id), queryFn: () => api.listMessages(id) });
export const useNotifications = (id: string) => useQuery({ queryKey: keys.notifications(id), queryFn: () => api.listNotifications(id) });
export const useActivity = (id: string) => useQuery({ queryKey: keys.activity(id), queryFn: () => api.listActivity(id) });
export const useCrew = (id: string) => useQuery({ queryKey: keys.crew(id), queryFn: () => api.listCrew(id) });
export const useKnowledge = (id: string) => useQuery({ queryKey: keys.knowledge(id), queryFn: () => api.listKnowledge(id) });

/**
 * Mutation that toasts the outcome and refreshes the affected data, plus the
 * project summary, activity log and notifications (triggers update those server-side).
 */
export function useSave<V>(
  projectId: string,
  fn: (vars: V) => Promise<unknown>,
  opts: { invalidate: (readonly unknown[])[]; success?: string | ((vars: V) => string) },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, vars) => {
      const msg = typeof opts.success === "function" ? opts.success(vars) : opts.success;
      if (msg) toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      for (const k of [
        ...opts.invalidate,
        keys.project(projectId),
        keys.projects,
        keys.activity(projectId),
        keys.notifications(projectId),
      ]) {
        void qc.invalidateQueries({ queryKey: k });
      }
    },
  });
}
