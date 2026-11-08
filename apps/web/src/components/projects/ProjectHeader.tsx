"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Project } from "@projectflow/shared";
import { Button } from "@/components/ui/Button";
import { ProjectStatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export function ProjectHeader({
  project,
  onEdit,
  onDelete,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color ?? "#6366f1" }} />
            <h1 className="truncate text-xl font-semibold text-zinc-900 dark:text-zinc-100">{project.name}</h1>
          </div>
          {project.description && (
            <p className="mt-1.5 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil size={14} /> Edit
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ProjectStatusBadge status={project.status} />
        <PriorityBadge priority={project.priority} />
        {project.tags?.map((t) => (
          <span key={t.id} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {t.name}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span>Start: {formatDate(project.startDate)}</span>
        {project.targetEndDate && <span>Target end: {formatDate(project.targetEndDate)}</span>}
        {project.actualEndDate && <span>Completed: {formatDate(project.actualEndDate)}</span>}
      </div>

      {project.notes && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">
          {project.notes}
        </p>
      )}
    </div>
  );
}
