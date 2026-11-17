import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useInbox } from '@/hooks/engagement';
import { AppNotification, fetchNotifications } from '@/services/notifications';
import { clearAll, deleteNotification, markAllRead, markRead } from '@/services/inbox';
import { PUSH_STATUS_TEXT, PushStatus, permissionStatus, pushSupport, registerForPush } from '@/services/push';
import { ScreenHeader } from '@/components/Chrome';
import { Chip, EmptyState, ErrorState, FadeIn, Skeleton } from '@/components/ui';
import { colors, fonts, radius, type } from '@/theme';
import { timeAgo } from '@/utils/format';
import { friendlyMessage } from '@/logic/apiErrors';
import { InboxItem, categoryMeta, groupByDay } from '@/logic/engagement';
import { notificationTarget, parseLink } from '@/logic/deepLinks';
import { openTarget } from '@/lib/navigation';
import { cdnImage } from '@/logic/cdnImage';

type Filter = 'all' | 'unread' | 'activity';
const TONE = {
  primary: [colors.primarySoft, colors.primary],
  accent: [colors.accentSoft, colors.accent],
  success: [colors.successSoft, colors.success],
  warning: [colors.warningSoft, colors.warning],
} as const;

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const uid = session?.user.id;
  const qc = useQueryClient();
  const inbox = useInbox();
  const activity = useQuery({ queryKey: ['activity', uid], queryFn: () => fetchNotifications(uid!), enabled: !!uid });
  const [filter, setFilter] = useState<Filter>('all');
  const [push, setPush] = useState<PushStatus | 'granted' | null>(null);

  useEffect(() => {
    const unsupported = pushSupport();
    if (unsupported) setPush(unsupported);
    else permissionStatus().then((p) => setPush(p === 'granted' ? 'granted' : p));
  }, []);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['inbox'] });
    qc.invalidateQueries({ queryKey: ['inbox-unread'] });
  };

  const items = inbox.data || [];
  const unread = items.filter((n) => !n.readAt);
  const sections = useMemo(() => groupByDay(filter === 'unread' ? unread : items), [filter, items, unread]);

  const open = async (n: InboxItem) => {
    if (!n.readAt) markRead([n.id]).then(refresh).catch(() => undefined);
    const target = parseLink(n.actionUrl) || notificationTarget({ courseId: n.courseId, bundleId: n.bundleId, offerId: n.offerId });
    if (target.kind === 'internal' && target.path === '/notifications') return;
    openTarget(target);
  };

  const menu = (n: InboxItem) =>
    Alert.alert(n.title, undefined, [
      ...(!n.readAt ? [{ text: 'Mark as read', onPress: () => markRead([n.id]).then(refresh).catch(() => undefined) }] : []),
      { text: 'Delete', style: 'destructive' as const, onPress: () => deleteNotification(n.id).then(refresh).catch((e) => Alert.alert('Couldn’t delete', friendlyMessage(e))) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const clear = () =>
    Alert.alert('Clear all notifications?', 'This removes every notification from your notification centre.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: () => uid && clearAll(uid).then(refresh).catch((e) => Alert.alert('Couldn’t clear', friendlyMessage(e))) },
    ]);

  const turnOn = async () => {
    const r = await registerForPush(true);
    setPush(r === 'registered' ? 'granted' : r);
    if (r === 'denied') Alert.alert('Notifications are off', 'Turn on notifications for Edufy Academy in your phone’s settings.', [{ text: 'OK' }]);
  };

  const header = (
    <View style={{ gap: 14, marginBottom: 6 }}>
      {push && push !== 'granted' && push !== 'registered' && (
        <View style={styles.pushCard}>
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={type.small}>{PUSH_STATUS_TEXT[push]}</Text>
            {push === 'undetermined' && (
              <Pressable onPress={turnOn} accessibilityRole="button"><Text style={[type.smallStrong, { color: colors.primary }]}>Turn on notifications</Text></Pressable>
            )}
            {push === 'denied' && (
              <Pressable onPress={() => router.push('/notification-settings')} accessibilityRole="button"><Text style={[type.smallStrong, { color: colors.primary }]}>Notification settings</Text></Pressable>
            )}
          </View>
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Chip label="All" count={items.length} active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Unread" count={unread.length} active={filter === 'unread'} onPress={() => setFilter('unread')} />
        <Chip label="Activity" active={filter === 'activity'} onPress={() => setFilter('activity')} />
      </ScrollView>
      {filter !== 'activity' && items.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable disabled={!unread.length} onPress={() => uid && markAllRead(uid).then(refresh).catch(() => undefined)} accessibilityRole="button">
            <Text style={[type.smallStrong, { color: unread.length ? colors.primary : colors.subtle }]}>Mark all as read</Text>
          </Pressable>
          <Pressable onPress={clear} accessibilityRole="button"><Text style={[type.smallStrong, { color: colors.danger }]}>Clear all</Text></Pressable>
        </View>
      )}
    </View>
  );

  const loading = filter === 'activity' ? activity.isLoading : inbox.isLoading;
  const error = filter === 'activity' ? activity.error : inbox.error;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Notifications"
        right={
          <Pressable onPress={() => router.push('/notification-settings')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Notification settings">
            <Ionicons name="settings-outline" size={22} color={colors.ink} />
          </Pressable>
        }
      />
      {error ? (
        <ErrorState message={friendlyMessage(error)} onRetry={() => (filter === 'activity' ? activity.refetch() : inbox.refetch())} />
      ) : loading ? (
        <View style={{ padding: 20, gap: 12 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 84, borderRadius: radius.xl }} />)}</View>
      ) : filter === 'activity' ? (
        <SectionList
          sections={groupByDay((activity.data || []).map((a) => ({ ...a, createdAt: a.at })))}
          keyExtractor={(n) => n.id}
          ListHeaderComponent={header}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: 20, gap: 10, flexGrow: 1, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={activity.isRefetching} onRefresh={async () => { await activity.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}
          renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
          renderItem={({ item }) => <ActivityRow item={item} />}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="No activity yet" body="Enrollment and purchase confirmations appear here." />}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          ListHeaderComponent={header}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: 20, gap: 10, flexGrow: 1, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={inbox.isRefetching} onRefresh={async () => { await inbox.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}
          renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
          renderItem={({ item, index }) => (
            <FadeIn delay={Math.min(index, 6) * 40}>
              <InboxRow item={item} onPress={() => open(item)} onMenu={() => menu(item)} />
            </FadeIn>
          )}
          ListEmptyComponent={
            filter === 'unread'
              ? <EmptyState icon="checkmark-done-outline" title="You’re all caught up" body="No unread notifications." />
              : <EmptyState icon="notifications-outline" title="No notifications yet" body="New courses, offers, announcements and your achievements will appear here." />
          }
        />
      )}
    </View>
  );
}

const InboxRow: React.FC<{ item: InboxItem; onPress: () => void; onMenu: () => void }> = ({ item, onPress, onMenu }) => {
  const meta = categoryMeta(item.category);
  const [bg, fg] = TONE[meta.tone];
  const unread = !item.readAt;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMenu}
      style={({ pressed }) => [styles.card, unread && styles.cardUnread, pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 }]}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${item.title}. ${item.body}`}
      accessibilityHint="Long press for more options"
    >
      <View style={[styles.icon, { backgroundColor: bg }]}><Ionicons name={meta.icon as any} size={19} color={fg} /></View>
      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[type.bodyStrong, { flex: 1 }]} numberOfLines={2}>{item.title}</Text>
          {unread && <View style={styles.dot} />}
        </View>
        <Text style={type.body} numberOfLines={3}>{item.body}</Text>
        {item.imageUrl && <Image source={{ uri: cdnImage(item.imageUrl, 720) }} style={styles.image} contentFit="cover" transition={150} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[type.small, { color: fg, fontFamily: fonts.bodySemi }]}>{meta.label}</Text>
          <Text style={type.small}>· {timeAgo(item.createdAt)}</Text>
        </View>
      </View>
      <Pressable onPress={onMenu} hitSlop={10} accessibilityRole="button" accessibilityLabel="More options" style={{ paddingLeft: 4 }}>
        <Ionicons name="ellipsis-vertical" size={18} color={colors.subtle} />
      </Pressable>
    </Pressable>
  );
};

const ActivityRow: React.FC<{ item: AppNotification }> = ({ item }) => (
  <Pressable
    onPress={() => item.courseId && router.push(`/learn/${item.courseId}`)}
    style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    accessibilityRole="button"
  >
    <View style={[styles.icon, { backgroundColor: item.kind === 'purchase' ? colors.successSoft : colors.primarySoft }]}>
      <Ionicons name={item.kind === 'purchase' ? 'card' : 'school'} size={19} color={item.kind === 'purchase' ? colors.success : colors.primary} />
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={type.bodyStrong}>{item.title}</Text>
      <Text style={type.body}>{item.body}</Text>
      <Text style={type.small}>{timeAgo(item.at)}</Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  cardUnread: { borderColor: '#C9D6FF', backgroundColor: '#FBFCFF' },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.secondary },
  image: { width: '100%', aspectRatio: 2, borderRadius: radius.md, marginTop: 6, backgroundColor: colors.primarySoft },
  section: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted, marginTop: 8, marginBottom: 2 },
  pushCard: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.xl, backgroundColor: colors.primarySoft },
});
