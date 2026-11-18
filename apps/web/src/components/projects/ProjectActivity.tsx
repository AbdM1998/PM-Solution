"use client";

import { Activity } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { useProjectActivity } from "@/hooks/useProjects";
import { formatDateTime } from "@/lib/utils";

function describe(action: string, metadata: unknown): string {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const q = (v: unknown) => (v ? `“${String(v)}”` : "");
  switch (action) {
    case "project.created":
      return `Project created ${q(m.name)}`;
    case "project.updated":
      return `Project details updated${Array.isArray(m.fields) ? ` (${(m.fields as string[]).join(", ")})` : ""}`;
    case "task.created":
      return `Task added ${q(m.title)}`;
    case "task.updated":
      return `Task updated${Array.isArray(m.fields) ? ` (${(m.fields as string[]).join(", ")})` : ""}`;
    case "stage.created":
      return `Stage added ${q(m.name)}`;
    case "stage.deleted":
      return `Stage deleted ${q(m.name)}`;
    case "stage.preset_applied":
      return `Lifecycle created from the ${String(m.preset)} template`;
    case "stage.advanced":
      return `Stage ${q(m.completed)} completed — moved to ${q(m.next)}`;
    case "stage.lifecycle_completed":
      return `Final stage ${q(m.completed)} completed — project completed`;
    case "file.uploaded":
      return `File uploaded ${q(m.fileName)}`;
    case "file.deleted":
      return `File deleted ${q(m.fileName)}`;
    default:
      return action;
  }
}

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
            <p className="text-sm text-zinc-700 dark:text-zinc-200" dir="auto">
              {describe(a.action, a.metadata)}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{formatDateTime(a.createdAt)}</p>
          </div>
        </div>
      ))}
    </Card>
  );
}
