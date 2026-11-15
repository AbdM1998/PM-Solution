"use client";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/auth-context";

export function useReportsSummary() {
  const api = useApi();
  return useQuery({
    queryKey: ["reports-summary"],
    queryFn: () => api.getReportsSummary(),
  });
}
