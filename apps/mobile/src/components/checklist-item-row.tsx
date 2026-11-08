import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { ChecklistItem } from '@projectflow/shared';

import { SwipeableRow } from '@/components/swipeable-row';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A nested checklist item row with quick-complete: tap the circle, or swipe left. */
export function ChecklistItemRow({
  item,
  depth = 0,
  onToggle,
}: {
  item: ChecklistItem;
  depth?: number;
  onToggle: (nowComplete: boolean) => void;
}) {
  const theme = useTheme();
  const isDone = item.status === 'COMPLETED';

  const row = (
    <Pressable
      onPress={() => onToggle(!isDone)}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1, paddingLeft: Spacing.two + depth * Spacing.four }]}>
      <SymbolView
        name={{
          ios: isDone ? 'checkmark.circle.fill' : 'circle',
          android: isDone ? 'check_circle' : 'radio_button_unchecked',
          web: isDone ? 'check_circle' : 'radio_button_unchecked',
        }}
        size={20}
        tintColor={isDone ? theme.success : theme.textSecondary}
      />
      <View style={styles.textCol}>
        <ThemedText
          type="small"
          numberOfLines={2}
          themeColor={isDone ? 'textSecondary' : 'text'}
          style={isDone ? styles.strikethrough : undefined}>
          {item.title}
        </ThemedText>
      </View>
    </Pressable>
  );

  if (isDone) return row;
  return <SwipeableRow onSwipeComplete={() => onToggle(true)}>{row}</SwipeableRow>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingRight: Spacing.two,
  },
  textCol: {
    flex: 1,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
});
