import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Image } from 'expo-image';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { AppSocialLink } from '@/logic/siteSettings';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAuth } from '@/context/AuthContext';
import { useCertificates, useMyLearning } from '@/hooks/queries';
import { Avatar, Badge } from '@/components/ui';
import { colors, radius, type } from '@/theme';
import { formatDate } from '@/utils/format';

type Item = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; hint?: string; danger?: boolean };

export default function ProfileTab() {
  const site = useSiteSettings(); // social links: Admin → Settings → Social media
  const { profile, profileError, session, signOut, refreshProfile } = useAuth();
  const { items, completed } = useMyLearning();
  const certs = useCertificates();

  const confirmLogout = () =>
    Alert.alert('Log out?', 'You can sign back in any time with the same account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);

  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Learning',
      items: [
        { icon: 'speedometer-outline', label: 'Student dashboard', onPress: () => router.push('/dashboard') },
        { icon: 'library-outline', label: 'My courses', hint: `${items.length}`, onPress: () => router.push('/(tabs)/learning') },
        { icon: 'ribbon-outline', label: 'My certificates', hint: certs.data?.length ? `${certs.data.length}` : undefined, onPress: () => router.push('/certificates') },
        { icon: 'albums-outline', label: 'Course bundles', onPress: () => router.push('/bundles') },
        { icon: 'newspaper-outline', label: 'Blog', onPress: () => router.push('/blog') },
        { icon: 'receipt-outline', label: 'Payment history', onPress: () => router.push('/payments') },
        { icon: 'notifications-outline', label: 'Notifications', onPress: () => router.push('/notifications') },
      ],
    },
    {
      title: 'Account',
      items: [
        { icon: 'person-outline', label: 'Edit profile', onPress: () => router.push('/edit-profile') },
        { icon: 'key-outline', label: 'Change password', onPress: () => router.push('/change-password') },
        { icon: 'settings-outline', label: 'Account settings', onPress: () => router.push('/settings') },
        { icon: 'log-out-outline', label: 'Log out', onPress: confirmLogout, danger: true },
      ],
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 40 }}>
        <Text style={type.h1}>Profile</Text>
        {!!profileError && !profile && (
          <Pressable onPress={refreshProfile} style={styles.warn} accessibilityRole="button">
            <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
            <Text style={[type.small, { color: colors.warning, flex: 1 }]}>{profileError} Tap to retry.</Text>
          </Pressable>
        )}
        <View style={styles.hero}>
          <Avatar uri={profile?.avatarUrl} name={profile?.fullName} size={76} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={type.h2} numberOfLines={1}>{profile?.fullName || session?.user.user_metadata?.full_name || 'Student'}</Text>
            <Text style={type.small} numberOfLines={1}>{profile?.email || session?.user.email}</Text>
            {!!profile?.phone && <Text style={type.small}>{profile.phone}</Text>}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              <Badge label="Student" />
              {!!profile?.createdAt && <Badge label={`Since ${formatDate(profile.createdAt)}`} tone="accent" />}
            </View>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat value={items.length} label="Enrolled" />
          <View style={styles.statDivider} />
          <Stat value={items.length - completed.length} label="In progress" />
          <View style={styles.statDivider} />
          <Stat value={completed.length} label="Completed" />
        </View>

        {groups.map((g) => (
          <View key={g.title} style={{ gap: 8 }}>
            <Text style={[type.eyebrow, { color: colors.muted }]}>{g.title}</Text>
            <View style={styles.group}>
              {g.items.map((it, i) => (
                <Pressable key={it.label} onPress={it.onPress} style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && { backgroundColor: colors.bg }]} accessibilityRole="button">
                  <View style={[styles.rowIcon, it.danger && { backgroundColor: colors.dangerSoft }]}>
                    <Ionicons name={it.icon} size={19} color={it.danger ? colors.danger : colors.primary} />
                  </View>
                  <Text style={[type.bodyStrong, { flex: 1 }, it.danger && { color: colors.danger }]}>{it.label}</Text>
                  {!!it.hint && <Text style={type.small}>{it.hint}</Text>}
                  {!it.danger && <Ionicons name="chevron-forward" size={18} color={colors.subtle} />}
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        {site.app.showSocialLinks && site.social.links.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={[type.eyebrow, { color: colors.muted }]}>Follow {site.general.siteName}</Text>
            <View style={styles.socialRow}>
              {site.social.links.map((s) => <SocialButton key={s.id} profile={s} />)}
            </View>
          </View>
        )}
        <Text style={[type.small, { textAlign: 'center' }]}>{site.general.appName} · v{Constants.expoConfig?.version || '1.0.0'}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const SOCIAL_ICON: Record<string, keyof typeof Ionicons.glyphMap | null> = {
  facebook: 'logo-facebook',
  instagram: 'logo-instagram',
  linkedin: 'logo-linkedin',
  x: null, // drawn as the 𝕏 letter mark (no X glyph in the bundled icon font)
  pinterest: 'logo-pinterest',
  reddit: 'logo-reddit',
  youtube: 'logo-youtube',
  whatsapp: 'logo-whatsapp',
  telegram: 'paper-plane',
  custom: 'link-outline',
};

const SocialButton: React.FC<{ profile: AppSocialLink }> = ({ profile }) => {
  const icon = profile.platform in SOCIAL_ICON ? SOCIAL_ICON[profile.platform] : 'link-outline';
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(profile.url).catch(() => undefined)}
      style={({ pressed }) => [styles.social, pressed && { opacity: 0.8, transform: [{ scale: 0.96 }] }]}
      accessibilityRole="link"
      accessibilityLabel={`Edufy Academy on ${profile.label}`}
    >
      {profile.platform === 'custom' && profile.icon ? (
        <Image source={{ uri: profile.icon }} style={{ width: 20, height: 20 }} contentFit="contain" />
      ) : icon ? (
        <Ionicons name={icon} size={20} color={colors.primary} />
      ) : (
        <Text style={styles.xMark}>𝕏</Text>
      )}
    </Pressable>
  );
};

const Stat: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <View style={{ flex: 1, alignItems: 'center' }}>
    <Text style={[type.h1, { color: colors.primary }]}>{value}</Text>
    <Text style={type.small}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.warningSoft },
  hero: { flexDirection: 'row', gap: 16, alignItems: 'center', padding: 18, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  stats: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  statDivider: { width: 1, height: 36, backgroundColor: colors.border },
  group: { borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.hairline },
  socialRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  social: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  xMark: { fontSize: 19, fontWeight: '700', color: colors.primary, lineHeight: 22 },
  rowIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
