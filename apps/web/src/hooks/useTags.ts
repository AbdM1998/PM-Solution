"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/auth-context";

export function useTags() {
  const api = useApi();
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => api.listTags(),
  });
}

export function useCreateTag() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => api.createTag(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}
