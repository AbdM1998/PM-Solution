"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/auth-context";

export function useChecklistItems(taskId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["checklist-items", taskId],
    queryFn: () => api.listChecklistItems(taskId),
    enabled: !!taskId,
  });
}

export function useCreateChecklistItem(taskId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.createChecklistItem(taskId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-items", taskId] }),
  });
}

export function useUpdateChecklistItem(taskId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => api.updateChecklistItem(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-items", taskId] }),
  });
}

export function useCompleteChecklistItem(taskId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.completeChecklistItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-items", taskId] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteChecklistItem(taskId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteChecklistItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-items", taskId] }),
  });
}

export function useReorderChecklistItems(taskId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; newIndex: number }[]) => api.reorderChecklistItems(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-items", taskId] }),
  });
}

export function useChecklistTemplates() {
  const api = useApi();
  return useQuery({
    queryKey: ["checklist-templates"],
    queryFn: () => api.listChecklistTemplates(),
  });
}

export function useCreateChecklistTemplate() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.createChecklistTemplate(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-templates"] }),
  });
}

export function useApplyChecklistTemplate(taskId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => api.applyChecklistTemplate(templateId, taskId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist-items", taskId] }),
  });
}
