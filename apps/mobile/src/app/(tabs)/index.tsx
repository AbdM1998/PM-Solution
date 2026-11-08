import { useMemo, useState } from 'react';
import { router, type Href } from 'expo-router';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MyDayItem, SnoozeOption } from '@projectflow/shared';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { MyDayRow } from '@/components/my-day-row';
import { SnoozeSheet } from '@/components/snooze-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useCompleteOccurrence, useDashboardSummary, useMyDay, useSnoozeOccurrence } from '@/hooks/use-dashboard';
import { useTheme } from '@/hooks/use-theme';

type Section = { key: 'overdue' | 'today' | 'snoozed' | 'completedToday'; title: string; data: MyDayItem[] };

function entityHref(item: MyDayItem): Href {
  if (item.entityType === 'TASK') return { pathname: '/task/[id]', params: { id: item.entityId } };
  // PROJECT, and CHECKLIST_ITEM (whose MyDayItem doesn't carry its parent task id, so
  // the best we can do without an extra lookup is open the project it belongs to).
  return { pathname: '/project/[id]', params: { id: item.projectId } };
}

export default function TodayScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const myDay = useMyDay();
  const summary = useDashboardSummary();
  const completeOccurrence = useCompleteOccurrence();
  const snoozeOccurrence = useSnoozeOccurrence();
  const [snoozeTarget, setSnoozeTarget] = useState<string | null>(null);

  const sections = useMemo<Section[]>(() => {
    if (!myDay.data) return [];
    const all: Section[] = [
      { key: 'overdue', title: 'Overdue', data: myDay.data.overdue },
      { key: 'today', title: 'Today', data: myDay.data.today },
      { key: 'snoozed', title: 'Snoozed', data: myDay.data.snoozed },
      { key: 'completedToday', title: 'Completed today', data: myDay.data.completedToday },
    ];
    return all.filter((section) => section.data.length > 0);
  }, [myDay.data]);

  if (myDay.isLoading) return <LoadingState label="Loading your day…" />;
  if (myDay.isError) {
    return <ErrorState message="Couldn't load My Day. The API may be unreachable." onRetry={() => myDay.refetch()} />;
  }

  const allEmpty = sections.length === 0;

  return (
    <ThemedView style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.occurrenceId}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset + Spacing.four }]}
        refreshControl={
          <RefreshControl refreshing={myDay.isRefetching} onRefresh={() => { void myDay.refetch(); void summary.refetch(); }} tintColor={theme.primary} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="title" style={styles.greeting}>
              Hi{user ? `, ${user.name.split(' ')[0]}` : ''}
            </ThemedText>
            {summary.data && (
              <View style={styles.statsRow}>
                <StatChip label="Active projects" value={summary.data.activeProjects} />
                <StatChip label="Overdue" value={summary.data.overdueTasks} tone="danger" />
                <StatChip label="Due today" value={summary.data.tasksDueToday} />
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <ThemedView style={styles.sectionHeader}>
            <ThemedText type="smallBold" themeColor={section.key === 'overdue' ? 'overdue' : 'textSecondary'}>
              {section.title.toUpperCase()} · {section.data.length}
            </ThemedText>
          </ThemedView>
        )}
        renderItem={({ item, section }) => (
          <MyDayRow
            item={item}
            variant={section.key === 'overdue' ? 'overdue' : section.key === 'completedToday' ? 'completed' : section.key === 'snoozed' ? 'snoozed' : 'default'}
            onPress={() => router.push(entityHref(item))}
            onComplete={section.key === 'completedToday' ? undefined : () => completeOccurrence.mutate(item.occurrenceId)}
            onSnooze={section.key === 'completedToday' ? undefined : () => setSnoozeTarget(item.occurrenceId)}
          />
        )}
        ListEmptyComponent={
          allEmpty ? (
            <EmptyState
              icon={{ ios: 'checkmark.circle', android: 'task_alt', web: 'task_alt' }}
              title="Nothing due today"
              message="Enjoy the quiet — anything due will show up here."
            />
          ) : undefined
        }
        stickySectionHeadersEnabled={false}
      />

      <SnoozeSheet
        visible={!!snoozeTarget}
        onClose={() => setSnoozeTarget(null)}
        onConfirm={(option: SnoozeOption, customAt, label) => {
          if (!snoozeTarget) return;
          snoozeOccurrence.mutate({ occurrenceId: snoozeTarget, option, customAt, label });
          setSnoozeTarget(null);
        }}
      />
    </ThemedView>
  );
}

function StatChip({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'danger' }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" themeColor={tone === 'danger' && value > 0 ? 'overdue' : 'text'}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.three, gap: 0 },
  header: { gap: Spacing.three, marginBottom: Spacing.three },
  greeting: { fontSize: 28, lineHeight: 34 },
  statsRow: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    gap: 2,
  },
  sectionHeader: { paddingVertical: Spacing.two },
});
