import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { PriorityBadge, ProjectStatusBadge } from '@/components/badge';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ProgressBar } from '@/components/progress-bar';
import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCompleteTask, useProject, useProjectTasks, useReopenTask } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, pluralize } from '@/lib/format';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const project = useProject(id);
  const tasks = useProjectTasks(id);
  const completeTask = useCompleteTask(id);
  const reopenTask = useReopenTask(id);

  if (project.isLoading) return <LoadingState label="Loading project…" />;
  if (project.isError || !project.data) {
    return <ErrorState message="Couldn't load this project. The API may be unreachable." onRetry={() => project.refetch()} />;
  }

  const p = project.data;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: p.name }} />
      <FlatList
        data={tasks.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={tasks.isRefetching} onRefresh={() => { void tasks.refetch(); }} tintColor={theme.primary} />
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <ProjectStatusBadge status={p.status} />
              <PriorityBadge priority={p.priority} />
            </View>

            {p.description && <ThemedText themeColor="textSecondary">{p.description}</ThemedText>}

            <View>
              <ProgressBar percent={p.completionPercent} height={10} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.progressLabel}>
                {p.completionPercent}% complete · {pluralize(p.completedTaskCount, 'task')} done
              </ThemedText>
            </View>

            <View style={styles.statsGrid}>
              <StatCell label="Started" value={formatDate(p.startDate)} />
              <StatCell label="Elapsed" value={pluralize(p.daysElapsed, 'day')} />
              <StatCell
                label={p.daysOverdue > 0 ? 'Overdue by' : 'Remaining'}
                value={p.daysOverdue > 0 ? pluralize(p.daysOverdue, 'day') : p.daysRemaining !== null ? pluralize(p.daysRemaining, 'day') : '—'}
                tone={p.daysOverdue > 0 ? 'danger' : 'default'}
              />
              <StatCell label="Open tasks" value={String(p.pendingTaskCount)} />
            </View>

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.tasksHeading}>
              TASKS · {tasks.data?.total ?? 0}
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <TaskRow
            task={item}
            onPress={() => router.push({ pathname: '/task/[id]', params: { id: item.id } })}
            onToggleComplete={(nowComplete) => (nowComplete ? completeTask.mutate(item.id) : reopenTask.mutate(item.id))}
          />
        )}
        ListEmptyComponent={
          tasks.isError ? (
            <ErrorState message="Couldn't load tasks." onRetry={() => tasks.refetch()} />
          ) : tasks.isLoading ? (
            <LoadingState label="Loading tasks…" />
          ) : (
            <EmptyState icon={{ ios: 'list.bullet', android: 'checklist', web: 'checklist' }} title="No tasks yet" />
          )
        }
      />
    </ThemedView>
  );
}

function StatCell({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' }) {
  const theme = useTheme();
  return (
    <View style={[styles.statCell, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold" themeColor={tone === 'danger' ? 'overdue' : 'text'}>
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
  listContent: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  header: { gap: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  badgeRow: { flexDirection: 'row', gap: Spacing.two },
  progressLabel: { marginTop: Spacing.one },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  statCell: { flexBasis: '47%', flexGrow: 1, borderRadius: Spacing.three, padding: Spacing.two, gap: 2 },
  tasksHeading: { marginTop: Spacing.two },
  separator: { height: 1 },
});
