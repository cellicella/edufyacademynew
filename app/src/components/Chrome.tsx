import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { colors, fonts, type } from '@/theme';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { isHttps } from '@/logic/siteSettings';

/** App logo: Admin → Settings → Branding (mobile app logo), falling back to the bundled official logo. */
export const Logo: React.FC<{ size?: number; light?: boolean; subtitle?: boolean }> = ({ size = 40, light, subtitle = true }) => {
  const site = useSiteSettings();
  const remote = [site.branding.appLogo, site.branding.logoMain].find(isHttps);
  const [failed, setFailed] = useState<string | null>(null);
  const name = site.general.appName || 'Edufy Academy';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Image
        source={remote && failed !== remote ? { uri: remote } : require('../../assets/images/logo.png')}
        onError={() => remote && setFailed(remote)}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityLabel={name}
      />
      <View>
        {name === 'Edufy Academy' ? (
          <Text style={{ fontFamily: fonts.display, fontSize: size * 0.5, color: light ? colors.white : colors.ink, letterSpacing: -0.3 }}>
            Edufy <Text style={{ color: light ? '#A5B8FF' : colors.secondary }}>Academy</Text>
          </Text>
        ) : (
          <Text style={{ fontFamily: fonts.display, fontSize: size * 0.5, color: light ? colors.white : colors.ink, letterSpacing: -0.3 }}>{name}</Text>
        )}
        {subtitle && !!site.general.tagline && (
          <Text style={{ fontFamily: fonts.bodySemi, fontSize: size * 0.22, letterSpacing: 1.6, color: light ? 'rgba(255,255,255,0.7)' : colors.muted }}>
            {site.general.tagline.toUpperCase()}
          </Text>
        )}
      </View>
    </View>
  );
};

/** Stack-screen header with back button */
export const ScreenHeader: React.FC<{ title?: string; right?: React.ReactNode; transparent?: boolean; light?: boolean; onBack?: () => void }> = ({ title, right, transparent, light, onBack }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6 }, !transparent && { backgroundColor: colors.bg }]}>
      <Pressable
        onPress={onBack || (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={[styles.back, transparent && { backgroundColor: 'rgba(255,255,255,0.92)' }]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={[type.h3, { flex: 1, textAlign: 'center', color: light ? colors.white : colors.ink }]} numberOfLines={1}>{title || ''}</Text>
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
};

/** Shows a slim banner while the device is offline. */
export const OfflineBanner: React.FC = () => {
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();
  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false)), []);
  if (!offline) return null;
  return (
    <View style={[styles.offline, { paddingTop: insets.top + 4 }]} accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={16} color={colors.white} />
      <Text style={{ fontFamily: fonts.bodySemi, color: colors.white, fontSize: 13 }}>You’re offline — showing saved content</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  offline: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 6 },
});
