import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { registerForPush, watchTokenChanges } from '@/services/push';
import { fetchUnreadCount, markPushRead, subscribeInbox } from '@/services/inbox';
import { notificationTarget } from '@/logic/deepLinks';
import { openTarget, pendingLink } from '@/lib/navigation';

/**
 * Connects push notifications to the app (rendered once, inside the auth + query providers):
 *  • registers this device's push token for the signed-in student (and again if it rotates)
 *  • refreshes the notification centre / unread badge when a push arrives or the inbox changes
 *  • opens the right screen when a notification is tapped — app open, in background or closed;
 *    if the student is signed out, the destination is kept and opened after sign-in
 *  • never handles the same tap twice
 */
export function NotificationBridge() {
  const { session, initializing } = useAuth();
  const qc = useQueryClient();
  const uid = session?.user.id;
  const uidRef = useRef<string | undefined>(uid);
  uidRef.current = uid;
  const handled = useRef(new Set<string>());

  const refreshInbox = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['inbox'] });
    qc.invalidateQueries({ queryKey: ['inbox-unread'] });
  }, [qc]);

  // Signed-in state for pending destinations
  useEffect(() => {
    if (!initializing) pendingLink.setSignedIn(!!uid);
  }, [uid, initializing]);

  // Register the push token (no permission prompt here — the student opts in from Home or Settings)
  useEffect(() => {
    if (!uid) return;
    registerForPush(false).catch(() => undefined);
    return watchTokenChanges(() => {
      registerForPush(false).catch(() => undefined);
    });
  }, [uid]);

  // Push received while the app is open → update the notification centre and badge
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => refreshInbox());
    return () => sub.remove();
  }, [refreshInbox]);

  // Live inbox changes (other devices marking read, new records) + refresh on foreground
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeInbox(uid, refreshInbox);
    const app = AppState.addEventListener('change', (s) => s === 'active' && refreshInbox());
    return () => {
      unsub();
      app.remove();
    };
  }, [uid, refreshInbox]);

  // Keep the launcher badge in sync with unread notifications
  useEffect(() => {
    if (!uid) {
      Notifications.setBadgeCountAsync(0).catch(() => undefined);
      return;
    }
    const sync = () => fetchUnreadCount(uid).then((n) => Notifications.setBadgeCountAsync(n)).catch(() => undefined);
    sync();
    const app = AppState.addEventListener('change', (s) => s === 'background' && sync());
    return () => app.remove();
  }, [uid]);

  const handleResponse = useCallback(
    (r: Notifications.NotificationResponse, coldStart: boolean) => {
      if (r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const id = r.notification.request.identifier;
      if (handled.current.has(id)) return;
      handled.current.add(id);
      const data = (r.notification.request.content.data || {}) as Record<string, unknown>;
      // Local learning reminders carry their own in-app route
      const target = notificationTarget(data);

      const current = uidRef.current;
      if (current) markPushRead(current, data).then(refreshInbox).catch(() => undefined);
      if (coldStart || !current || !pendingLink.isReady()) {
        // Opened from a closed app or while signed out: the splash / sign-in decides first
        pendingLink.set(target);
        if (!current && !coldStart) router.replace('/(auth)/login');
        return;
      }
      openTarget(target);
    },
    [refreshInbox]
  );

  // Taps while the app is running (foreground or background)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => handleResponse(r, false));
    return () => sub.remove();
  }, [handleResponse]);

  // Tap that launched the app from a closed state
  const coldChecked = useRef(false);
  useEffect(() => {
    if (initializing || coldChecked.current || Platform.OS === 'web') return;
    coldChecked.current = true;
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (r) {
          handleResponse(r, true);
          Notifications.clearLastNotificationResponseAsync?.().catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }, [initializing, handleResponse]);

  // A newly signed-in student: load their notification centre
  useEffect(() => {
    if (uid) refreshInbox();
  }, [uid, refreshInbox]);

  return null;
}
