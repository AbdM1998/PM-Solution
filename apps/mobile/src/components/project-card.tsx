import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { Project } from '@projectflow/shared';

import { PriorityBadge, ProjectStatusBadge } from '@/components/badge';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { pluralize } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

export function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <ThemedView type="card" style={[styles.card, { borderColor: theme.border }]}>
        <View style={styles.headerRow}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
            {project.name}
          </ThemedText>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={theme.textSecondary} />
        </View>

        <View style={styles.badgeRow}>
          <ProjectStatusBadge status={project.status} />
          <PriorityBadge priority={project.priority} />
          {project.overdueTaskCount > 0 && (
            <View style={[styles.overdueChip, { backgroundColor: theme.danger }]}>
              <ThemedText type="small" themeColor="primaryText">
                {pluralize(project.overdueTaskCount, 'task')} overdue
              </ThemedText>
            </View>
          )}
        </View>

        <ProgressBar percent={project.completionPercent} />

        <View style={styles.statsRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {project.completionPercent}% complete
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {project.daysRemaining !== null ? `${project.daysRemaining}d left` : `${project.daysElapsed}d elapsed`}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {pluralize(project.pendingTaskCount, 'task')} open
          </ThemedText>
        </View>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  overdueChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
