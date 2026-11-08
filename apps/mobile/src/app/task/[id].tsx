import { useMemo } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { ChecklistItem } from '@projectflow/shared';

import { PriorityBadge, TaskStatusBadge } from '@/components/badge';
import { ChecklistItemRow } from '@/components/checklist-item-row';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useChecklistItems, useTask, useToggleChecklistItem } from '@/hooks/use-task';
import { useTheme } from '@/hooks/use-theme';
import { formatDateTime } from '@/lib/format';

/** Flattens the checklist item tree (arbitrary nesting via `parentId`, per FR4) into
 * document order with a depth for indentation. */
function flattenTree(items: ChecklistItem[]): { item: ChecklistItem; depth: number }[] {
  const byParent = new Map<string | null, ChecklistItem[]>();
  for (const item of items) {
    const key = item.parentId ?? null;
    const siblings = byParent.get(key) ?? [];
    siblings.push(item);
    byParent.set(key, siblings);
  }
  for (const siblings of byParent.values()) siblings.sort((a, b) => a.orderIndex - b.orderIndex);

  const result: { item: ChecklistItem; depth: number }[] = [];
  function visit(parentId: string | null, depth: number) {
    for (const item of byParent.get(parentId) ?? []) {
      result.push({ item, depth });
      visit(item.id, depth + 1);
    }
  }
  visit(null, 0);
  return result;
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const task = useTask(id);
  const checklistItems = useChecklistItems(id);
  const toggleItem = useToggleChecklistItem(id);

  const rows = useMemo(() => flattenTree(checklistItems.data ?? []), [checklistItems.data]);
  const doneCount = (checklistItems.data ?? []).filter((i) => i.status === 'COMPLETED').length;

  if (task.isLoading) return <LoadingState label="Loading task…" />;
  if (task.isError || !task.data) {
    return <ErrorState message="Couldn't load this task. The API may be unreachable." onRetry={() => task.refetch()} />;
  }

  const t = task.data;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t.title }} />
      <FlatList
        data={rows}
        keyExtractor={({ item }) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={checklistItems.isRefetching} onRefresh={() => { void checklistItems.refetch(); }} tintColor={theme.primary} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <TaskStatusBadge status={t.status} />
              <PriorityBadge priority={t.priority} />
            </View>
            {t.description && <ThemedText themeColor="textSecondary">{t.description}</ThemedText>}
            {t.dueDate && (
              <ThemedText type="small" themeColor="textSecondary">
                Due {formatDateTime(t.dueDate)}
              </ThemedText>
            )}
            <Pressable onPress={() => router.push({ pathname: '/project/[id]', params: { id: t.projectId } })} style={styles.projectLink}>
              <SymbolView name={{ ios: 'folder', android: 'folder', web: 'folder' }} size={14} tintColor={theme.primary} />
              <ThemedText type="small" themeColor="primary">
                Open project
              </ThemedText>
            </Pressable>

            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.checklistHeading}>
              CHECKLIST · {doneCount}/{checklistItems.data?.length ?? 0} done
            </ThemedText>
          </View>
        }
        renderItem={({ item: row }) => (
          <ChecklistItemRow
            item={row.item}
            depth={row.depth}
            onToggle={(nowComplete) => toggleItem.mutate({ id: row.item.id, nowComplete })}
          />
        )}
        ListEmptyComponent={
          checklistItems.isError ? (
            <ErrorState message="Couldn't load the checklist." onRetry={() => checklistItems.refetch()} />
          ) : checklistItems.isLoading ? (
            <LoadingState label="Loading checklist…" />
          ) : (
            <EmptyState icon={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }} title="No checklist items" />
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  header: { gap: Spacing.two, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  badgeRow: { flexDirection: 'row', gap: Spacing.two },
  projectLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.one },
  checklistHeading: { marginTop: Spacing.two },
});
