import type { ComponentProps } from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

/** `NativeTabs` has no web renderer, so the web preview (this app's only
 * device/emulator-free smoke test in this environment) uses this JS-rendered bottom
 * bar instead, matching the scaffold's own native/web split convention. */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon={{ ios: 'sun.max', android: 'today', web: 'today' }}>Today</TabButton>
          </TabTrigger>
          <TabTrigger name="projects" href="/projects" asChild>
            <TabButton icon={{ ios: 'folder', android: 'folder', web: 'folder' }}>Projects</TabButton>
          </TabTrigger>
          <TabTrigger name="calendar" href="/calendar" asChild>
            <TabButton icon={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }}>Calendar</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}>Settings</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  icon,
  ...props
}: TabTriggerSlotProps & { icon: SymbolViewProps['name'] }) {
  const theme = useTheme();
  return (
    // `TabTriggerSlotProps`'s `ref` type (expo-router/ui) and `Pressable`'s `ref` type
    // (react-native-web, this exact dependency combo) disagree structurally even
    // though they're compatible at runtime — this exact spread pattern is unchanged
    // from the scaffold-generated version of this file. Cast narrows the spread to
    // what `Pressable` actually expects rather than fighting the upstream type clash.
    <Pressable {...(props as ComponentProps<typeof Pressable>)} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type={isFocused ? 'backgroundSelected' : 'backgroundElement'} style={styles.tabButtonView}>
        <SymbolView name={icon} size={16} tintColor={isFocused ? theme.primary : theme.textSecondary} />
        <ThemedText type="small" themeColor={isFocused ? 'primary' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          ProjectFlow
        </ThemedText>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
});
