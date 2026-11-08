import { StyleSheet } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function EmptyState({
  icon = { ios: 'tray', android: 'inbox', web: 'inbox' },
  title,
  message,
}: {
  icon?: SymbolViewProps['name'];
  title: string;
  message?: string;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <SymbolView name={icon} tintColor={theme.textSecondary} size={32} />
      <ThemedText type="smallBold" style={styles.title}>
        {title}
      </ThemedText>
      {message && (
        <ThemedText themeColor="textSecondary" style={styles.message}>
          {message}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  title: {
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
});
