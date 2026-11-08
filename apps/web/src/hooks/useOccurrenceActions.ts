"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/auth-context";
import type { SnoozeOption } from "@projectflow/shared";

/** Shared snooze/complete actions used by My Day, Calendar, and reminder panels. */
export function useOccurrenceActions() {
  const api = useApi();
  const qc = useQueryClient();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["occurrences"] });
  };

  const complete = useMutation({
    mutationFn: (occurrenceId: string) => api.completeOccurrence(occurrenceId),
    onSuccess: invalidateAll,
  });

  const snooze = useMutation({
    mutationFn: ({ occurrenceId, option, customAt }: { occurrenceId: string; option: SnoozeOption; customAt?: string }) =>
      api.snoozeOccurrence(occurrenceId, option, customAt),
    onSuccess: invalidateAll,
  });

  return { complete, snooze };
}
