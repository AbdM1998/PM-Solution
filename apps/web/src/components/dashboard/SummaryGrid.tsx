import type { LucideIcon } from "lucide-react";
import { AlertCircle, Bell, CheckCircle2, ClipboardList, FolderKanban, FolderOpen, ListTodo } from "lucide-react";
import type { DashboardSummary } from "@projectflow/shared";
import { Card } from "@/components/ui/Card";

function Metric({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "default" | "warning";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
        <Icon
          size={16}
          className={tone === "warning" ? "text-amber-500" : "text-zinc-400 dark:text-zinc-500"}
        />
      </div>
      <p
        className={`mt-2 text-2xl font-semibold ${
          tone === "warning" && value > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

export function SummaryGrid({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <Metric icon={FolderKanban} label="Total projects" value={summary.totalProjects} />
      <Metric icon={FolderOpen} label="Active projects" value={summary.activeProjects} />
      <Metric icon={CheckCircle2} label="Completed projects" value={summary.completedProjects} />
      <Metric icon={ListTodo} label="Due today" value={summary.tasksDueToday} />
      <Metric icon={AlertCircle} label="Overdue tasks" value={summary.overdueTasks} tone="warning" />
      <Metric icon={Bell} label="Upcoming reminders" value={summary.upcomingReminders} />
      <Metric icon={ClipboardList} label="Pending checklists" value={summary.pendingChecklists} />
    </div>
  );
}
