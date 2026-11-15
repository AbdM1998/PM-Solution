"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/lib/auth-context";

export function useAdminUsers() {
  const api = useApi();
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.listAdminUsers(),
  });
}

export function useIntegrationsStatus() {
  const api = useApi();
  return useQuery({
    queryKey: ["admin-integrations"],
    queryFn: () => api.getIntegrationsStatus(),
  });
}

export function useSetUserAdmin() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isAdmin }: { id: string; isAdmin: boolean }) => api.setUserAdmin(id, isAdmin),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useDeleteAdminUser() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAdminUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}
