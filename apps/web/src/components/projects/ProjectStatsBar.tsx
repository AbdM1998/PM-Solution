import type { Project } from "@projectflow/shared";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

// All values here are server-computed (see Project.* in packages/shared/src/types.ts) —
// never a manually-entered percent field.
export function ProjectStatsBar({ project }: { project: Project }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Progress</span>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{project.completionPercent}%</span>
      </div>
      <ProgressBar percent={project.completionPercent} className="mb-5" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Duration" value={`${project.durationDays}d`} />
        <Stat label="Elapsed" value={`${project.daysElapsed}d`} />
        <Stat
          label="Remaining"
          value={project.daysRemaining !== null ? `${project.daysRemaining}d` : "—"}
        />
        <Stat
          label="Overdue"
          value={
            <span className={project.daysOverdue > 0 ? "text-red-600 dark:text-red-400" : undefined}>
              {project.daysOverdue}d
            </span>
          }
        />
        <Stat label="Completed tasks" value={project.completedTaskCount} />
        <Stat label="Pending tasks" value={project.pendingTaskCount} />
        <Stat
          label="Overdue tasks"
          value={
            <span className={project.overdueTaskCount > 0 ? "text-red-600 dark:text-red-400" : undefined}>
              {project.overdueTaskCount}
            </span>
          }
        />
      </div>
    </Card>
  );
}
