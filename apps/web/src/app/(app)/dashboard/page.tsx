"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { SummaryGrid } from "@/components/dashboard/SummaryGrid";
import { RecentProjects } from "@/components/dashboard/RecentProjects";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { useDashboardSummary } from "@/hooks/useDashboard";

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useDashboardSummary();

  return (
    <div>
      <PageHeader title="Dashboard" description="Your projects, at a glance." />

      {isLoading && <PageSpinner label="Loading summary…" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && (
        <div className="space-y-8">
          <SummaryGrid summary={data} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Recently updated projects</h2>
              <RecentProjects projects={data.recentlyUpdatedProjects} />
            </section>
            <section>
              <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Recent activity</h2>
              <RecentActivity activity={data.recentActivity} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
