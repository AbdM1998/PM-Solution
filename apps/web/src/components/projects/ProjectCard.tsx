import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { Project } from "@projectflow/shared";
import { Card } from "@/components/ui/Card";
import { ProjectStatusBadge, PriorityBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDate } from "@/lib/utils";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="flex h-full flex-col p-4 transition-colors hover:border-accent-300 dark:hover:border-accent-700">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: project.color ?? "#6366f1" }}
            />
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{project.name}</h3>
          </div>
          {project.daysOverdue > 0 && (
            <span title={`${project.daysOverdue} day(s) overdue`}>
              <AlertTriangle size={15} className="text-amber-500" />
            </span>
          )}
        </div>

        {project.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">{project.description}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <ProjectStatusBadge status={project.status} />
          <PriorityBadge priority={project.priority} />
          {project.tags?.map((t) => (
            <span
              key={t.id}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {t.name}
            </span>
          ))}
        </div>

        <div className="mt-4 flex-1" />

        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{project.completedTaskCount + project.pendingTaskCount} tasks</span>
            <span>{project.completionPercent}%</span>
          </div>
          <ProgressBar percent={project.completionPercent} />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
          <span>Started {formatDate(project.startDate)}</span>
          {project.targetEndDate && <span>Due {formatDate(project.targetEndDate)}</span>}
        </div>
      </Card>
    </Link>
  );
}
