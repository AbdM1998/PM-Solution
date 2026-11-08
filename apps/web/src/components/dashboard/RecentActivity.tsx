import { Activity } from "lucide-react";
import type { DashboardSummary } from "@projectflow/shared";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { formatDateTime } from "@/lib/utils";

export function RecentActivity({ activity }: { activity: DashboardSummary["recentActivity"] }) {
  if (activity.length === 0) {
    return <EmptyState title="No activity yet" description="Actions across your projects will show up here." />;
  }

  return (
    <Card className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {activity.map((a) => (
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
