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

export function useCreateAdminUser() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; isAdmin?: boolean; whatsappNumber?: string }) =>
      api.createAdminUser(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useUpdateAdminUser() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; isAdmin?: boolean; isActive?: boolean; whatsappNumber?: string | null; password?: string };
    }) => api.updateAdminUser(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
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

export function useAdminReminders() {
  const api = useApi();
  return useQuery({ queryKey: ["admin-reminders"], queryFn: () => api.listAdminReminders() });
}

export function useSetAdminReminderActive() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.setAdminReminderActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reminders"] }),
  });
}

export function useAdminDeliveries() {
  const api = useApi();
  return useQuery({
    queryKey: ["admin-deliveries"],
    queryFn: () => api.listAdminDeliveries(),
    refetchInterval: 15_000,
  });
}

export function useSendTestNotification() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, to }: { channel: "EMAIL" | "WHATSAPP"; to: string }) => api.sendTestNotification(channel, to),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-deliveries"] }),
  });
}

export function useAdminAttachments() {
  const api = useApi();
  return useQuery({ queryKey: ["admin-attachments"], queryFn: () => api.listAdminAttachments() });
}
