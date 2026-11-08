import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function ProgressBar({ percent, height = 8 }: { percent: number; height?: number }) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(100, percent));
  const color = clamped >= 100 ? theme.success : theme.primary;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.fill, { width: `${clamped}%`, height, borderRadius: height / 2, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    minWidth: 2,
  },
});
