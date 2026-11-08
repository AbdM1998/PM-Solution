import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { AppNotification } from '@projectflow/shared';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatDateTime } from '@/lib/format';
import { useTheme } from '@/hooks/use-theme';

export function NotificationRow({ notification, onPress }: { notification: AppNotification; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      {!notification.isRead && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
      <View style={[styles.textCol, notification.isRead && styles.readTextCol]}>
        <ThemedText type={notification.isRead ? 'small' : 'smallBold'} numberOfLines={2}>
          {notification.title}
        </ThemedText>
        {notification.body && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {notification.body}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {formatDateTime(notification.createdAt)}
          {notification.projectName ? ` · ${notification.projectName}` : ''}
        </ThemedText>
      </View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={14} tintColor={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  readTextCol: {
    marginLeft: 16,
  },
});
