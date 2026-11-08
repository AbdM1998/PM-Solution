import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SnoozeOption } from '@projectflow/shared';

import { apiClient } from '@/lib/api';
import { confirmActionLocally } from '@/lib/notifications';

export function useDashboardSummary() {
  return useQuery({ queryKey: ['dashboard-summary'], queryFn: () => apiClient.dashboardSummary() });
}

export function useMyDay() {
  return useQuery({ queryKey: ['my-day'], queryFn: () => apiClient.myDay() });
}

export function useCompleteOccurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (occurrenceId: string) => apiClient.completeOccurrence(occurrenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-day'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useSnoozeOccurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      occurrenceId,
      option,
      customAt,
      label,
    }: {
      occurrenceId: string;
      option: SnoozeOption;
      customAt?: string;
      /** human-readable snooze target, e.g. "6:00 PM" — used only for the local confirmation */
      label: string;
    }) => {
      const result = await apiClient.snoozeOccurrence(occurrenceId, option, customAt);
      await confirmActionLocally('Reminder snoozed', `We'll remind you again ${label}.`);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-day'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}
