import { useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProjectStatus } from '@projectflow/shared';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ProjectCard } from '@/components/project-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useProjects } from '@/hooks/use-projects';
import { useTheme } from '@/hooks/use-theme';

const FILTERS: { label: string; status?: ProjectStatus }[] = [
  { label: 'All' },
  { label: 'In progress', status: 'IN_PROGRESS' },
  { label: 'On hold', status: 'ON_HOLD' },
  { label: 'Completed', status: 'COMPLETED' },
];

export default function ProjectsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [filterIndex, setFilterIndex] = useState(0);
  const status = FILTERS[filterIndex].status;
  const projects = useProjects(status ? { status } : {});

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <ThemedText type="title" style={styles.heading}>
          Projects
        </ThemedText>
        <View style={styles.filterRow}>
          {FILTERS.map((filter, index) => (
            <Pressable
              key={filter.label}
              onPress={() => setFilterIndex(index)}
              style={[
                styles.filterChip,
                { backgroundColor: index === filterIndex ? theme.primary : theme.backgroundElement },
              ]}>
              <ThemedText type="small" themeColor={index === filterIndex ? 'primaryText' : 'textSecondary'}>
                {filter.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {projects.isLoading ? (
        <LoadingState label="Loading projects…" />
      ) : projects.isError ? (
        <ErrorState message="Couldn't load projects. The API may be unreachable." onRetry={() => projects.refetch()} />
      ) : (
        <FlatList
          data={projects.data?.items ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + BottomTabInset + Spacing.four }]}
          refreshControl={<RefreshControl refreshing={projects.isRefetching} onRefresh={() => { void projects.refetch(); }} tintColor={theme.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          renderItem={({ item }) => (
            <ProjectCard project={item} onPress={() => router.push({ pathname: '/project/[id]', params: { id: item.id } })} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={{ ios: 'folder', android: 'folder', web: 'folder' }}
              title="No projects here"
              message={status ? 'Try a different filter.' : 'Projects you create will show up here.'}
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
  filterRow: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: Spacing.three },
  listContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.one },
});
