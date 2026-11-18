"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiClient } from "@projectflow/shared";
import { useApi } from "@/lib/auth-context";

export function useAttachments(projectId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ["attachments", projectId],
    queryFn: () => api.listAttachments(projectId),
    enabled: !!projectId,
  });
}

export function useUploadAttachment(projectId: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, taskId }: { file: File; taskId?: string }) =>
      api.uploadAttachment(projectId, file, file.name, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attachments", projectId] });
      qc.invalidateQueries({ queryKey: ["admin-attachments"] });
    },
  });
}

export function useDeleteAttachment(projectId?: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAttachment(id),
    onSuccess: () => {
      if (projectId) qc.invalidateQueries({ queryKey: ["attachments", projectId] });
      qc.invalidateQueries({ queryKey: ["admin-attachments"] });
    },
  });
}

/** Downloads through the authenticated API (a plain <a href> can't send the bearer
 * token), then hands the blob to the browser as a normal file save. */
export async function downloadAttachment(api: ApiClient, id: string, fileName: string) {
  const blob = await api.downloadAttachment(id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
