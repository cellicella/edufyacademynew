import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/context/AuthContext';
import { useAutoplayPref } from '@/hooks/useAutoplayPref';
import { ScreenHeader } from '@/components/Chrome';
import { colors, radius, type } from '@/theme';
import { config } from '@/lib/config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { supportContacts } from '@/logic/siteSettings';

export default function Settings() {
  const site = useSiteSettings(); // support contacts: Admin → Settings → App Configuration / Contact / WhatsApp
  const support = supportContacts(site, config.webUrl);
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [autoplay, setAutoplay] = useAutoplayPref();
  const Row: React.FC<{ icon: keyof typeof Ionicons.glyphMap; title: string; onPress: () => void; danger?: boolean }> = ({ icon, title, onPress, danger }) => (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bg }]} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
      <Text style={[type.bodyStrong, { flex: 1 }, danger && { color: colors.danger }]}>{title}</Text>
      {!danger && <Ionicons name="chevron-forward" size={18} color={colors.subtle} />}
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Account settings" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: insets.bottom + 32 }}>
        <View style={{ gap: 8 }}>
          <Text style={[type.eyebrow, { color: colors.muted }]}>Notifications</Text>
          <View style={styles.group}>
            <Row icon="notifications-outline" title="Notification settings" onPress={() => router.push('/notification-settings')} />
            <Row icon="file-tray-full-outline" title="Notification centre" onPress={() => router.push('/notifications')} />
          </View>
          <Text style={type.small}>Choose which announcements you receive and set a daily learning reminder.</Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[type.eyebrow, { color: colors.muted }]}>Playback</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <Ionicons name="play-forward-outline" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>Autoplay next lesson</Text>
                <Text style={type.small}>Start the next video 5 seconds after one finishes</Text>
              </View>
              <Switch value={autoplay} onValueChange={setAutoplay} trackColor={{ true: colors.secondary, false: colors.border }} thumbColor={colors.white} />
            </View>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[type.eyebrow, { color: colors.muted }]}>Account</Text>
          <View style={styles.group}>
            <Row icon="person-outline" title="Edit profile" onPress={() => router.push('/edit-profile')} />
            <Row icon="key-outline" title="Change password" onPress={() => router.push('/change-password')} />
            <Row icon="receipt-outline" title="Payment history" onPress={() => router.push('/payments')} />
            <Row icon="ribbon-outline" title="My certificates" onPress={() => router.push('/certificates')} />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[type.eyebrow, { color: colors.muted }]}>Help & support</Text>
          <View style={styles.group}>
            {!!support.helpUrl && <Row icon="help-circle-outline" title="Help & FAQ" onPress={() => WebBrowser.openBrowserAsync(support.helpUrl)} />}
            {!!support.supportUrl && <Row icon="headset-outline" title="Support centre" onPress={() => WebBrowser.openBrowserAsync(support.supportUrl)} />}
            {!!support.whatsappUrl && <Row icon="logo-whatsapp" title="Chat with us on WhatsApp" onPress={() => Linking.openURL(support.whatsappUrl!)} />}
            {!!support.phone && <Row icon="call-outline" title={`Call ${support.phone}`} onPress={() => Linking.openURL(`tel:+${support.phone.replace(/\D/g, '')}`)} />}
            {!!support.email && <Row icon="mail-outline" title={`Email ${support.email}`} onPress={() => Linking.openURL(`mailto:${support.email}`)} />}
            {!!config.webUrl && <Row icon="document-text-outline" title="Terms of service" onPress={() => WebBrowser.openBrowserAsync(`${config.webUrl}/terms`)} />}
            {!!config.webUrl && <Row icon="shield-checkmark-outline" title="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(`${config.webUrl}/privacy`)} />}
          </View>
        </View>

        <View style={styles.group}>
          <Row icon="log-out-outline" title="Log out" danger onPress={async () => { await signOut(); router.replace('/(auth)/login'); }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.hairline },
});
