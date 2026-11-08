import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api';

export function useProjects(params: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: () => apiClient.listProjects(params),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => apiClient.getProject(id as string),
    enabled: !!id,
  });
}

export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: () => apiClient.listTasks(projectId as string),
    enabled: !!projectId,
  });
}

/** Single-task quick-complete uses `bulk-complete` (with one id) rather than a plain
 * PATCH, so the server applies the same "cancel pending reminder occurrences on
 * complete" rule (FR6 / docs/REMINDER_ENGINE.md) that the dedicated complete endpoints
 * apply elsewhere — a raw status PATCH isn't documented to carry that side effect. */
export function useCompleteTask(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiClient.bulkCompleteTasks([taskId]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['my-day'] });
    },
  });
}

export function useReopenTask(projectId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiClient.updateTask(taskId, { status: 'TODO' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });
}
