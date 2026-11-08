"use client";

import type { SnoozeOption } from "@projectflow/shared";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageSpinner } from "@/components/ui/Spinner";
import { ErrorState, EmptyState } from "@/components/ui/States";
import { MyDaySection } from "@/components/myday/MyDaySection";
import { MyDayItemRow } from "@/components/myday/MyDayItemRow";
import { useMyDay } from "@/hooks/useDashboard";
import { useOccurrenceActions } from "@/hooks/useOccurrenceActions";
import { CheckCircle2 } from "lucide-react";

export default function MyDayPage() {
  const { data, isLoading, isError, error, refetch } = useMyDay();
  const { complete, snooze } = useOccurrenceActions();

  const totalCount = data ? data.today.length + data.overdue.length : 0;

  return (
    <div>
      <PageHeader
        title="My Day"
        description="Everything due today, across every project, in one place."
      />

      {isLoading && <PageSpinner label="Loading today…" />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}

      {data && (
        <div className="space-y-8">
          {totalCount === 0 && data.completedToday.length === 0 && data.snoozed.length === 0 && (
            <EmptyState
              icon={<CheckCircle2 size={24} />}
              title="Nothing due today"
              description="You're all caught up. Check back tomorrow or browse your projects."
            />
          )}

          {data.overdue.length > 0 && (
            <MyDaySection title="Overdue" count={data.overdue.length} tone="warning">
              {data.overdue.map((item) => (
                <MyDayItemRow
                  key={item.occurrenceId}
                  item={item}
                  variant="overdue"
                  completing={complete.isPending && complete.variables === item.occurrenceId}
                  snoozing={snooze.isPending && snooze.variables?.occurrenceId === item.occurrenceId}
                  onComplete={() => complete.mutate(item.occurrenceId)}
                  onSnooze={(option: SnoozeOption, customAt?: string) =>
                    snooze.mutate({ occurrenceId: item.occurrenceId, option, customAt })
                  }
                />
              ))}
            </MyDaySection>
          )}

          {data.today.length > 0 && (
            <MyDaySection title="Today" count={data.today.length}>
              {data.today.map((item) => (
                <MyDayItemRow
                  key={item.occurrenceId}
                  item={item}
                  completing={complete.isPending && complete.variables === item.occurrenceId}
                  snoozing={snooze.isPending && snooze.variables?.occurrenceId === item.occurrenceId}
                  onComplete={() => complete.mutate(item.occurrenceId)}
                  onSnooze={(option: SnoozeOption, customAt?: string) =>
                    snooze.mutate({ occurrenceId: item.occurrenceId, option, customAt })
                  }
                />
              ))}
            </MyDaySection>
          )}

          {data.snoozed.length > 0 && (
            <MyDaySection title="Snoozed" count={data.snoozed.length}>
              {data.snoozed.map((item) => (
                <MyDayItemRow
                  key={item.occurrenceId}
                  item={item}
                  variant="snoozed"
                  completing={complete.isPending && complete.variables === item.occurrenceId}
                  snoozing={snooze.isPending && snooze.variables?.occurrenceId === item.occurrenceId}
                  onComplete={() => complete.mutate(item.occurrenceId)}
                  onSnooze={(option: SnoozeOption, customAt?: string) =>
                    snooze.mutate({ occurrenceId: item.occurrenceId, option, customAt })
                  }
                />
              ))}
            </MyDaySection>
          )}

          {data.completedToday.length > 0 && (
            <MyDaySection title="Completed today" count={data.completedToday.length}>
              {data.completedToday.map((item) => (
                <MyDayItemRow key={item.occurrenceId} item={item} variant="completed" />
              ))}
            </MyDaySection>
          )}
        </div>
      )}
    </div>
  );
}
