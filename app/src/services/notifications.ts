import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { prefs } from '@/lib/secureStorage';
import { ensureChannels } from '@/services/push';

/**
 * Student notification architecture
 * ---------------------------------
 *  • Push notifications + notification centre — sent by the Edufy server (Expo Push Service) and
 *    stored in user_notifications. See services/push.ts, services/inbox.ts, NotificationBridge.
 *  • Activity — enrollment and purchase confirmations built from the student's own records.
 *  • Learning reminders — scheduled locally on the device (no server needed).
 */

export type NotificationKind = 'enrollment' | 'purchase';
export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string;
  courseId: string | null;
}

export function configureNotifications() {
  // Show pushes as a banner even while the app is open
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
  });
  ensureChannels().catch(() => undefined);
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const [enr, pay] = await Promise.all([
    supabase.from('enrollments').select('course_id, enrolled_at, courses(title)').eq('user_id', userId).eq('status', 'active').order('enrolled_at', { ascending: false }).limit(20),
    supabase.from('payments').select('id, course_id, amount, currency, notes, created_at, updated_at, courses(title)').eq('user_id', userId).eq('status', 'captured').order('created_at', { ascending: false }).limit(20),
  ]);
  if (enr.error && pay.error) throw new Error(enr.error.message);
  const title = (row: any) => (Array.isArray(row.courses) ? row.courses[0]?.title : row.courses?.title) || 'your course';
  const list: AppNotification[] = [];
  for (const e of enr.data || []) {
    list.push({ id: `enr-${e.course_id}`, kind: 'enrollment', title: 'Enrollment confirmed', body: `You now have lifetime access to ${title(e)}.`, at: e.enrolled_at, courseId: e.course_id });
  }
  for (const p of pay.data || []) {
    const amount = Number(p.amount) || 0;
    list.push({
      id: `pay-${p.id}`,
      kind: 'purchase',
      title: 'Purchase successful',
      body: `Payment of ₹${Math.round(amount).toLocaleString('en-IN')} received for ${(p.notes as any)?.courseTitle || title(p)}.`,
      at: p.updated_at || p.created_at,
      courseId: p.course_id,
    });
  }
  return list.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}

/* ---------------------------------------------------------- learning reminders */
const REMINDER_KEY = 'reminder';

export async function getReminder(): Promise<{ enabled: boolean; hour: number }> {
  const raw = await prefs.get(REMINDER_KEY);
  try {
    return raw ? JSON.parse(raw) : { enabled: false, hour: 19 };
  } catch {
    return { enabled: false, hour: 19 };
  }
}

export async function setReminder(enabled: boolean, hour = 19): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (enabled) {
    const perm = await Notifications.getPermissionsAsync();
    const granted = perm.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) {
      await prefs.set(REMINDER_KEY, JSON.stringify({ enabled: false, hour }));
      return false;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Time to learn 📚', body: 'A few minutes today keeps your progress moving. Continue your Edufy course.', data: { url: '/(tabs)/learning' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: 'reminders' },
    });
  }
  await prefs.set(REMINDER_KEY, JSON.stringify({ enabled, hour }));
  return true;
}
