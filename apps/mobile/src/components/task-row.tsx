import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { Task } from '@projectflow/shared';

import { PriorityBadge } from '@/components/badge';
import { SwipeableRow } from '@/components/swipeable-row';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

export function TaskRow({
  task,
  onPress,
  onToggleComplete,
}: {
  task: Task;
  onPress: () => void;
  onToggleComplete: (nowComplete: boolean) => void;
}) {
  const theme = useTheme();
  const isDone = task.status === 'DONE';
  const isOverdue = !isDone && !!task.dueDate && new Date(task.dueDate).getTime() < Date.now();

  const content = (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <Pressable onPress={() => onToggleComplete(!isDone)} hitSlop={8} style={styles.checkbox}>
        <SymbolView
          name={{
            ios: isDone ? 'checkmark.circle.fill' : 'circle',
            android: isDone ? 'check_circle' : 'radio_button_unchecked',
            web: isDone ? 'check_circle' : 'radio_button_unchecked',
          }}
          size={22}
          tintColor={isDone ? theme.success : theme.textSecondary}
        />
      </Pressable>
      <View style={styles.textCol}>
        <ThemedText
          numberOfLines={1}
          themeColor={isDone ? 'textSecondary' : 'text'}
          style={isDone ? styles.strikethrough : undefined}>
          {task.title}
        </ThemedText>
        {task.dueDate && (
          <ThemedText type="small" themeColor={isOverdue ? 'overdue' : 'textSecondary'}>
            Due {formatDate(task.dueDate)}
          </ThemedText>
        )}
      </View>
      <PriorityBadge priority={task.priority} />
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={14} tintColor={theme.textSecondary} />
    </Pressable>
  );

  if (isDone) return content;

  return <SwipeableRow onSwipeComplete={() => onToggleComplete(true)}>{content}</SwipeableRow>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  checkbox: {
    padding: 2,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
});
