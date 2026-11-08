import { Pressable, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Shown for a failed data fetch (including "the API isn't reachable") — never
 * silently swallowed, and always offers a retry rather than a dead end. */
export function ErrorState({
  message = "Couldn't load this. The server may be unreachable.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.container}>
      <SymbolView
        name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }}
        tintColor={theme.danger}
        size={32}
      />
      <ThemedText style={styles.message} themeColor="textSecondary">
        {message}
      </ThemedText>
      {onRetry && (
        <Pressable onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed, { backgroundColor: theme.primary }]}>
          <ThemedText themeColor="primaryText" type="smallBold">
            Try again
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  message: {
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
