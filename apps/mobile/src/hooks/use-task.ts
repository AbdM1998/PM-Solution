import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/lib/api';

export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => apiClient.getTask(taskId as string),
    enabled: !!taskId,
  });
}

export function useChecklistItems(taskId: string | undefined) {
  return useQuery({
    queryKey: ['checklist-items', taskId],
    queryFn: () => apiClient.listChecklistItems(taskId as string),
    enabled: !!taskId,
  });
}

/** Toggles a checklist item. Completing uses the dedicated `/complete` endpoint (which
 * cancels pending reminder occurrences per FR6); un-completing has no dedicated
 * endpoint in docs/API_DESIGN.md, so it falls back to a plain status PATCH. */
export function useToggleChecklistItem(taskId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nowComplete }: { id: string; nowComplete: boolean }) =>
      nowComplete ? apiClient.completeChecklistItem(id) : apiClient.updateChecklistItem(id, { status: 'PENDING' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-items', taskId] });
      queryClient.invalidateQueries({ queryKey: ['my-day'] });
    },
  });
}
