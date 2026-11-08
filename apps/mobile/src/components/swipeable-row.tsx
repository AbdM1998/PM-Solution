import { useRef, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/hooks/use-theme';

const SWIPE_THRESHOLD = 96;

/**
 * A single swipe-left gesture that completes a row (checklist item / My Day item).
 *
 * Built on React Native's core `PanResponder` + `Animated` rather than
 * `react-native-gesture-handler`'s newer hook-based gesture API: this SDK (Expo 58)
 * ships gesture-handler v3, whose Pan gesture moved to a hook API
 * (`usePanGesture`) that superseded the `Gesture.Pan()` builder — since this sandbox
 * has no device/emulator to interactively verify gesture behavior, we intentionally
 * used the long-stable core RN API here instead of a newer, unverified one.
 */
export function SwipeableRow({
  children,
  onSwipeComplete,
  disabled,
}: {
  children: ReactNode;
  onSwipeComplete: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (disabled) return false;
        return Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
      },
      onPanResponderMove: (_, gesture) => {
        // Only allow swiping left (negative dx) — completing is a one-directional action.
        const next = Math.min(0, gesture.dx);
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx <= -SWIPE_THRESHOLD) {
          onSwipeComplete();
        }
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      },
    }),
  ).current;

  const actionOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -16, 0],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.actionLayer, { backgroundColor: theme.success, opacity: actionOpacity }]}>
        <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={theme.primaryText} size={22} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  actionLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 24,
  },
});
