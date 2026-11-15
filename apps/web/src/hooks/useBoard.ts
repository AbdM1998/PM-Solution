"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/auth-context";

/** Cross-project Board (Kanban) data — see docs on BoardTask / GET /tasks for why
 * this is a separate query from the per-project useTasks. */
export function useBoardTasks() {
  const api = useApi();
  return useQuery({
    queryKey: ["board-tasks"],
    queryFn: () => api.listAllTasks(),
  });
}

export function useUpdateTaskStatus() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateTask(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["board-tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
