"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/auth-context";

export function useStages(projectId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["stages", projectId],
    queryFn: () => api.listStages(projectId),
    enabled: !!projectId,
  });
}

/** Every stage mutation can change stage states, task counts and the project's own
 * status (completing the last stage completes the project), so refresh all three. */
function useStageMutation<TArgs>(projectId: string, fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stages", projectId] });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateStage(projectId: string) {
  const api = useApi();
  return useStageMutation(projectId, (data: { name: string; description?: string }) => api.createStage(projectId, data));
}

export function useApplyStagePreset(projectId: string) {
  const api = useApi();
  return useStageMutation(projectId, (preset: string) => api.applyStagePreset(projectId, preset));
}

export function useUpdateStage(projectId: string) {
  const api = useApi();
  return useStageMutation(projectId, ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
    api.updateStage(projectId, id, data)
  );
}

export function useDeleteStage(projectId: string) {
  const api = useApi();
  return useStageMutation(projectId, (id: string) => api.deleteStage(projectId, id));
}

export function useReorderStages(projectId: string) {
  const api = useApi();
  return useStageMutation(projectId, (items: { stageId: string; newIndex: number }[]) =>
    api.reorderStages(projectId, items)
  );
}

export function useAdvanceStage(projectId: string) {
  const api = useApi();
  return useStageMutation(projectId, (_: void) => api.advanceStage(projectId));
}
