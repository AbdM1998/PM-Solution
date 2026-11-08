"use client";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/auth-context";

export function useDashboardSummary() {
  const api = useApi();
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api.dashboardSummary(),
  });
}

export function useMyDay() {
  const api = useApi();
  return useQuery({
    queryKey: ["dashboard", "my-day"],
    queryFn: () => api.myDay(),
    refetchInterval: 60_000,
  });
}
