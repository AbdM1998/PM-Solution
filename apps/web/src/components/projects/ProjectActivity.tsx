"use client";

import { Activity } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { useProjectActivity } from "@/hooks/useProjects";
import { formatDateTime } from "@/lib/utils";

export function ProjectActivity({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, error, refetch } = useProjectActivity(projectId);

  if (isLoading) return <PageSpinner label="Loading activity…" />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data || data.length === 0) {
    return <EmptyState title="No activity yet" description="Changes to this project will be logged here." />;
  }

  return (
    <Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {data.map((a) => (
        <div key={a.id} className="flex items-start gap-3 px-4 py-3">
          <Activity size={14} className="mt-0.5 shrink-0 text-zinc-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-700 dark:text-zinc-200">{a.action}</p>
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{formatDateTime(a.createdAt)}</p>
          </div>
        </div>
      ))}
    </Card>
  );
}
