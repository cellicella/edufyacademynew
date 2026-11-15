import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { ek, useNotificationPrefs } from '@/hooks/engagement';
import { DEFAULT_PREFS, NotificationPrefs, savePrefs } from '@/services/inbox';
import { getReminder, setReminder } from '@/services/notifications';
import { PUSH_STATUS_TEXT, PushStatus, registerForPush } from '@/services/push';
import { ScreenHeader } from '@/components/Chrome';
import { Button, ErrorState } from '@/components/ui';
import { colors, radius, type } from '@/theme';
import { friendlyMessage } from '@/logic/apiErrors';

const HOURS = [7, 9, 13, 19, 21];
const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;

const TOPICS: { key: keyof NotificationPrefs; icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { key: 'new_courses', icon: 'sparkles-outline', title: 'New course announcements', body: 'When a new course is published' },
  { key: 'bundles_offers', icon: 'albums-outline', title: 'Bundles', body: 'New course bundles and bundle deals' },
  { key: 'promotions', icon: 'pricetag-outline', title: 'Offers & promotions', body: 'Special discounts, festival and limited-time offers' },
  { key: 'announcements', icon: 'megaphone-outline', title: 'Important announcements', body: 'Updates and messages from Edufy Academy' },
  { key: 'learning_updates', icon: 'school-outline', title: 'My learning', body: 'Course updates, new lessons, completions and certificates' },
];

export default function NotificationSettings() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const uid = session?.user.id;
  const qc = useQueryClient();
  const prefsQ = useNotificationPrefs();
  const [values, setValues] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState<keyof NotificationPrefs | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [reminder, setRem] = useState<{ enabled: boolean; hour: number }>({ enabled: false, hour: 19 });

  useEffect(() => {
    if (prefsQ.data) setValues(prefsQ.data);
  }, [prefsQ.data]);

  const check = useCallback(async (ask = false) => {
    setChecking(true);
    try {
      setPush(await registerForPush(ask));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check(false);
    getReminder().then(setRem);
    // Re-check when the student comes back from the phone's settings
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check(false));
    return () => sub.remove();
  }, [check]);

  const toggleTopic = async (key: keyof NotificationPrefs, v: boolean) => {
    if (!uid) return;
    const next = { ...values, [key]: v };
    setValues(next);
    setSaving(key);
    try {
      await savePrefs(uid, next);
      qc.setQueryData(ek.prefs(uid), next);
    } catch (e) {
      setValues(values); // roll back
      Alert.alert('Couldn’t save', friendlyMessage(e));
    } finally {
      setSaving(null);
    }
  };

  const toggleReminder = async (enabled: boolean, hour = reminder.hour) => {
    const ok = await setReminder(enabled, hour);
    if (!ok) {
      Alert.alert('Notifications are off', 'Allow notifications for Edufy Academy in your phone settings to get learning reminders.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]);
      setRem({ enabled: false, hour });
      return;
    }
    setRem({ enabled, hour });
  };

  const on = push === 'registered';
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Notification settings" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: insets.bottom + 32 }}>
        <View style={[styles.status, { backgroundColor: on ? colors.successSoft : colors.primarySoft }]}>
          <Ionicons name={on ? 'notifications' : 'notifications-off-outline'} size={24} color={on ? colors.success : colors.primary} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={type.bodyStrong}>{on ? 'Push notifications are on' : 'Push notifications are off'}</Text>
            {checking ? <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start' }} /> : <Text style={type.small}>{push ? PUSH_STATUS_TEXT[push] : ''}</Text>}
            {push === 'undetermined' && <Button title="Allow notifications" size="sm" icon="notifications-outline" onPress={() => check(true)} style={{ alignSelf: 'flex-start' }} />}
            {push === 'denied' && <Button title="Open phone settings" size="sm" variant="outline" icon="settings-outline" onPress={() => Linking.openSettings()} style={{ alignSelf: 'flex-start' }} />}
            {push === 'error' && <Button title="Try again" size="sm" variant="outline" icon="refresh" onPress={() => check(true)} style={{ alignSelf: 'flex-start' }} />}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[type.eyebrow, { color: colors.muted }]}>What you’ll hear about</Text>
          {prefsQ.error ? (
            <ErrorState message={friendlyMessage(prefsQ.error)} onRetry={() => prefsQ.refetch()} />
          ) : (
            <View style={styles.group}>
              {TOPICS.map((t, i) => (
                <View key={t.key} style={[styles.row, i === TOPICS.length - 1 && { borderBottomWidth: 0 }]}>
                  <Ionicons name={t.icon} size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.bodyStrong}>{t.title}</Text>
                    <Text style={type.small}>{t.body}</Text>
                  </View>
                  {saving === t.key ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Switch
                      value={values[t.key]}
                      disabled={prefsQ.isLoading}
                      onValueChange={(v) => toggleTopic(t.key, v)}
                      trackColor={{ true: colors.secondary, false: colors.border }}
                      thumbColor={colors.white}
                      accessibilityLabel={t.title}
                    />
                  )}
                </View>
              ))}
            </View>
          )}
          <Text style={type.small}>These choices apply to this account on all your devices. Turned-off topics won’t be sent to you.</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[type.eyebrow, { color: colors.muted }]}>Learning reminders</Text>
          <View style={styles.group}>
            <View style={[styles.row, !reminder.enabled && { borderBottomWidth: 0 }]}>
              <Ionicons name="alarm-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>Daily learning reminder</Text>
                <Text style={type.small}>A gentle nudge from this phone at the time you choose</Text>
              </View>
              <Switch value={reminder.enabled} onValueChange={(v) => toggleReminder(v)} trackColor={{ true: colors.secondary, false: colors.border }} thumbColor={colors.white} accessibilityLabel="Daily learning reminder" />
            </View>
            {reminder.enabled && (
              <View style={[styles.row, { flexWrap: 'wrap', gap: 8, borderBottomWidth: 0 }]}>
                {HOURS.map((h) => (
                  <Pressable key={h} onPress={() => toggleReminder(true, h)} style={[styles.hour, reminder.hour === h && { backgroundColor: colors.primary, borderColor: colors.primary }]} accessibilityRole="button" accessibilityState={{ selected: reminder.hour === h }}>
                    <Text style={[type.smallStrong, reminder.hour === h && { color: colors.white }]}>{hourLabel(h)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        <Text style={type.small}>
          You can also choose which kinds of notification make a sound or appear on the lock screen in your phone’s Settings → Apps → Edufy Academy → Notifications.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', gap: 14, padding: 16, borderRadius: radius.xl },
  group: { borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  hour: { paddingHorizontal: 12, height: 34, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
});
