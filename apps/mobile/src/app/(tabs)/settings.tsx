import { useState } from 'react';
import { router, type Href } from 'expo-router';
import { Pressable, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppNotification } from '@projectflow/shared';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { NotificationRow } from '@/components/notification-row';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/use-notifications';
import { useTheme } from '@/hooks/use-theme';

function entityHref(notification: AppNotification): Href | null {
  if (notification.entityType === 'TASK' && notification.entityId) {
    return { pathname: '/task/[id]', params: { id: notification.entityId } };
  }
  if (notification.projectId) {
    return { pathname: '/project/[id]', params: { id: notification.projectId } };
  }
  return null;
}

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [loggingOut, setLoggingOut] = useState(false);

  const unreadCount = notifications.data?.filter((n) => !n.isRead).length ?? 0;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  function handlePress(notification: AppNotification) {
    if (!notification.isRead) markRead.mutate(notification.id);
    const href = entityHref(notification);
    if (href) router.push(href);
  }

  return (
    <ThemedView style={styles.container}>
      <SectionList
        sections={[{ key: 'notifications', data: notifications.data ?? [] }]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + BottomTabInset + Spacing.four }]}
        refreshControl={<RefreshControl refreshing={notifications.isRefetching} onRefresh={() => { void notifications.refetch(); }} tintColor={theme.primary} />}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <ThemedText type="title" style={styles.heading}>
              Settings
            </ThemedText>

            <ThemedView type="card" style={[styles.accountCard, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">{user?.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {user?.email}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Theme follows your system appearance setting.
              </ThemedText>
              <PrimaryButton title="Log out" variant="secondary" onPress={handleLogout} loading={loggingOut} style={styles.logoutButton} />
            </ThemedView>

            <View style={styles.notificationsHeaderRow}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                NOTIFICATIONS {unreadCount > 0 ? `(${unreadCount} unread)` : ''}
              </ThemedText>
              {unreadCount > 0 && (
                <Pressable onPress={() => markAllRead.mutate()}>
                  <ThemedText type="small" themeColor="primary">
                    Mark all read
                  </ThemedText>
                </Pressable>
              )}
            </View>

            <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
              In-app and email reminders are delivered by the server even when this app
              is closed. This device can also receive local confirmations for actions
              you take here (like snoozing) — see the app README for details.
            </ThemedText>
          </View>
        }
        renderItem={({ item }) =>
          notifications.isError ? null : <NotificationRow notification={item} onPress={() => handlePress(item)} />
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
        ListEmptyComponent={
          notifications.isLoading ? undefined : notifications.isError ? (
            <ErrorState message="Couldn't load notifications. The API may be unreachable." onRetry={() => notifications.refetch()} />
          ) : (
            <EmptyState icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }} title="No notifications yet" />
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: Spacing.three },
  headerSection: { gap: Spacing.three, marginBottom: Spacing.two },
  heading: { fontSize: 28, lineHeight: 34 },
  accountCard: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.one },
  logoutButton: { marginTop: Spacing.two },
  notificationsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footnote: { lineHeight: 18 },
  separator: { height: 1, marginLeft: Spacing.three },
});
