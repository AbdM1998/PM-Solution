import Link from "next/link";
import type { Project } from "@projectflow/shared";
import { Card } from "@/components/ui/Card";
import { ProjectStatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/States";

export function RecentProjects({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return <EmptyState title="No projects yet" description="Create a project to see it here." />;
  }

  return (
    <Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/projects/${p.id}`}
          className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{p.name}</span>
              <ProjectStatusBadge status={p.status} />
            </div>
            <div className="mt-1.5 max-w-xs">
              <ProgressBar percent={p.completionPercent} />
            </div>
          </div>
          <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{p.completionPercent}%</span>
        </Link>
      ))}
    </Card>
  );
}
