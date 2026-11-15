"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageSpinner } from "@/components/ui/Spinner";
import { useReportsSummary } from "@/hooks/useReports";

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  TODO: "To do",
  DONE: "Done",
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

function BreakdownBar({ counts, labels }: { counts: Record<string, number>; labels: Record<string, string> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-sm text-zinc-500 dark:text-zinc-400">No data yet.</p>;
  return (
    <div className="space-y-2">
      {Object.entries(counts).map(([key, count]) => (
        <div key={key} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 text-zinc-600 dark:text-zinc-300">{labels[key] ?? key}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-accent-500"
              style={{ width: `${(count / total) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-zinc-500 dark:text-zinc-400">{count}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReportsPage() {
  const { data, isLoading } = useReportsSummary();

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Reports" description="Progress across all your projects." />
        <PageSpinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reports" description="Progress across all your projects." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Overdue tasks</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{data.overdueCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Completed this week</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{data.completedThisWeek}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total projects</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{data.projects.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total tasks</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {Object.values(data.tasksByStatus).reduce((a, b) => a + b, 0)}
          </p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Projects by status</h3>
          <BreakdownBar counts={data.projectsByStatus} labels={STATUS_LABEL} />
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Tasks by status</h3>
          <BreakdownBar counts={data.tasksByStatus} labels={STATUS_LABEL} />
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Tasks by priority</h3>
          <BreakdownBar counts={data.tasksByPriority} labels={PRIORITY_LABEL} />
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Per-project progress</h2>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Tasks</th>
              <th className="px-4 py-2">Progress</th>
            </tr>
          </thead>
          <tbody>
            {data.projects.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="px-4 py-2 font-medium">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: p.color ?? "#71717a" }} />
                  {p.name}
                </td>
                <td className="px-4 py-2">
                  <Badge tone="neutral">{STATUS_LABEL[p.status] ?? p.status}</Badge>
                </td>
                <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                  {p.completedTasks} / {p.totalTasks}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${p.completionPct}%` }} />
                    </div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{p.completionPct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
