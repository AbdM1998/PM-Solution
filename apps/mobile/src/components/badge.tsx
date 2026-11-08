import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Priority, ProjectStatus, TaskStatus } from '@projectflow/shared';

export function Badge({ label, color = 'textSecondary', backgroundColor }: { label: string; color?: ThemeColor; backgroundColor?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: backgroundColor ?? theme.backgroundElement }]}>
      <ThemedText type="small" themeColor={color} style={styles.label}>
        {label}
      </ThemedText>
    </View>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const theme = useTheme();
  const map: Record<Priority, { label: string; color: string }> = {
    LOW: { label: 'Low', color: theme.textSecondary },
    MEDIUM: { label: 'Medium', color: theme.primary },
    HIGH: { label: 'High', color: theme.warning },
    URGENT: { label: 'Urgent', color: theme.danger },
  };
  const { label } = map[priority];
  return <Badge label={label} color="text" backgroundColor={theme.backgroundElement} />;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const theme = useTheme();
  const labels: Record<ProjectStatus, string> = {
    NOT_STARTED: 'Not started',
    IN_PROGRESS: 'In progress',
    ON_HOLD: 'On hold',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
  const bg = status === 'COMPLETED' ? theme.chipBackground : theme.backgroundElement;
  return <Badge label={labels[status]} backgroundColor={bg} color={status === 'COMPLETED' ? 'primary' : 'textSecondary'} />;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const labels: Record<TaskStatus, string> = {
    TODO: 'To do',
    IN_PROGRESS: 'In progress',
    DONE: 'Done',
    CANCELLED: 'Cancelled',
  };
  return <Badge label={labels[status]} />;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
});
