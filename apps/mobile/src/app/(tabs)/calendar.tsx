import { useMemo, useState } from 'react';
import { router, type Href } from 'expo-router';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { ReminderOccurrence } from '@projectflow/shared';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useOccurrencesInRange } from '@/hooks/use-occurrences';
import { useTheme } from '@/hooks/use-theme';
import { formatDayHeading, formatTime } from '@/lib/format';

function startOfWeek(offsetWeeks: number): Date {
  const now = new Date();
  const dayIndex = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayIndex + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function entityHref(occurrence: ReminderOccurrence): Href {
  if (occurrence.entityType === 'TASK') return { pathname: '/task/[id]', params: { id: occurrence.entityId } };
  return { pathname: '/project/[id]', params: { id: occurrence.projectId } };
}

export default function CalendarScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => startOfWeek(weekOffset), [weekOffset]);
  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return end;
  }, [weekStart]);

  const occurrences = useOccurrencesInRange(weekStart.toISOString(), weekEnd.toISOString());

  const sections = useMemo(() => {
    const items = occurrences.data ?? [];
    const byDay = new Map<string, ReminderOccurrence[]>();
    for (const item of items) {
      const dayKey = item.nextFireAt.slice(0, 10);
      const existing = byDay.get(dayKey) ?? [];
      existing.push(item);
      byDay.set(dayKey, existing);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, data]) => ({
        key: dayKey,
        title: formatDayHeading(data[0].nextFireAt),
        data: data.sort((a, b) => a.nextFireAt.localeCompare(b.nextFireAt)),
      }));
  }, [occurrences.data]);

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <ThemedText type="title" style={styles.heading}>
          Calendar
        </ThemedText>
        <View style={styles.weekNav}>
          <Pressable onPress={() => setWeekOffset((w) => w - 1)} hitSlop={8} style={styles.navButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={18} tintColor={theme.text} />
          </Pressable>
          <ThemedText type="smallBold">
            {weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(weekEnd.getTime() - 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </ThemedText>
          <Pressable onPress={() => setWeekOffset((w) => w + 1)} hitSlop={8} style={styles.navButton}>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={18} tintColor={theme.text} />
          </Pressable>
          {weekOffset !== 0 && (
            <Pressable onPress={() => setWeekOffset(0)} style={styles.todayButton}>
              <ThemedText type="small" themeColor="primary">
                Today
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>

      {occurrences.isLoading ? (
        <LoadingState label="Loading calendar…" />
      ) : occurrences.isError ? (
        <ErrorState message="Couldn't load the calendar. The API may be unreachable." onRetry={() => occurrences.refetch()} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + BottomTabInset + Spacing.four }]}
          refreshControl={<RefreshControl refreshing={occurrences.isRefetching} onRefresh={() => { void occurrences.refetch(); }} tintColor={theme.primary} />}
          renderSectionHeader={({ section }) => (
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {section.title.toUpperCase()}
              </ThemedText>
            </ThemedView>
          )}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(entityHref(item))} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
              <View style={[styles.timeChip, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small">{formatTime(item.nextFireAt)}</ThemedText>
              </View>
              <View style={styles.textCol}>
                <ThemedText numberOfLines={1}>{item.entityTitle}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {item.projectName}
                </ThemedText>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <EmptyState
              icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}
              title="Nothing scheduled this week"
            />
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  heading: { fontSize: 28, lineHeight: 34 },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  navButton: { padding: Spacing.one },
  todayButton: { marginLeft: 'auto', paddingHorizontal: Spacing.two, paddingVertical: Spacing.half },
  listContent: { paddingHorizontal: Spacing.three },
  sectionHeader: { paddingVertical: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  timeChip: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Spacing.two, minWidth: 72, alignItems: 'center' },
  textCol: { flex: 1, gap: 2 },
});
