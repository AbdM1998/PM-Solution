import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { MyDayItem } from '@projectflow/shared';

import { SwipeableRow } from '@/components/swipeable-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatTime } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

const ENTITY_ICON = {
  PROJECT: { ios: 'folder', android: 'folder', web: 'folder' } as const,
  TASK: { ios: 'list.bullet', android: 'checklist', web: 'checklist' } as const,
  CHECKLIST_ITEM: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' } as const,
};

/**
 * One row in the My Day list. Swipe left to complete (fewest-taps path); tap the row
 * to open the underlying project/task; long-press (or the clock button) to snooze.
 */
export function MyDayRow({
  item,
  variant = 'default',
  onPress,
  onComplete,
  onSnooze,
}: {
  item: MyDayItem;
  variant?: 'default' | 'overdue' | 'completed' | 'snoozed';
  onPress: () => void;
  onComplete?: () => void;
  onSnooze?: () => void;
}) {
  const theme = useTheme();
  const canAct = variant !== 'completed';

  const row = (
    <Pressable onPress={onPress} onLongPress={canAct ? onSnooze : undefined} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView name={ENTITY_ICON[item.entityType]} size={16} tintColor={variant === 'overdue' ? theme.overdue : theme.textSecondary} />
      </View>
      <View style={styles.textCol}>
        <ThemedText
          type="default"
          numberOfLines={1}
          style={variant === 'completed' ? styles.strikethrough : undefined}
          themeColor={variant === 'completed' ? 'textSecondary' : 'text'}>
          {item.title}
        </ThemedText>
        <ThemedText type="small" themeColor={variant === 'overdue' ? 'overdue' : 'textSecondary'} numberOfLines={1}>
          {item.projectName} · {formatTime(item.time)}
        </ThemedText>
      </View>
      {canAct && onSnooze && (
        <Pressable onPress={onSnooze} style={styles.iconButton} hitSlop={8}>
          <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={18} tintColor={theme.textSecondary} />
        </Pressable>
      )}
      {canAct && onComplete && (
        <Pressable onPress={onComplete} style={styles.iconButton} hitSlop={8}>
          <SymbolView name={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }} size={22} tintColor={theme.success} />
        </Pressable>
      )}
      {variant === 'completed' && (
        <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={18} tintColor={theme.success} />
      )}
    </Pressable>
  );

  if (!canAct || !onComplete) {
    return <ThemedView style={styles.container}>{row}</ThemedView>;
  }

  return (
    <ThemedView style={styles.container}>
      <SwipeableRow onSwipeComplete={onComplete}>{row}</SwipeableRow>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  iconButton: {
    padding: Spacing.one,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
});
