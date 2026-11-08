"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/auth-context";
import type { ReminderEntityType } from "@projectflow/shared";

export function useReminders(entityType: ReminderEntityType, entityId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["reminders", entityType, entityId],
    queryFn: () => api.listReminders(entityType, entityId),
    enabled: !!entityId,
  });
}

export function useCreateReminder(entityType: ReminderEntityType, entityId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.createReminder(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", entityType, entityId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["occurrences"] });
    },
  });
}

export function useDeleteReminder(entityType: ReminderEntityType, entityId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteReminder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", entityType, entityId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["occurrences"] });
    },
  });
}

export function useOccurrences(params: Record<string, string> = {}) {
  const api = useApi();
  return useQuery({
    queryKey: ["occurrences", params],
    queryFn: () => api.listOccurrences(params),
  });
}
