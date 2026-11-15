import React, { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { googleButtonLabel } from '@/logic/siteSettings';
import { googleAvailability } from '@/logic/authProviders';
import { useAuthProviders } from '@/services/authProviders';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { colors, fonts, radius, type } from '@/theme';

/**
 * Google's official "G" mark. Download it from Google's sign-in branding page
 * (developers.google.com/identity/branding-guidelines → "Download sign-in assets"), save the PNG as
 * app/assets/images/google-g.png and replace `null` below with: require('../../assets/images/google-g.png')
 * Until then a neutral Google glyph from the bundled icon set is shown.
 */
const GOOGLE_MARK: number | null = null;

/**
 * "Continue with Google": the primary sign-in option. Opens Google in the system browser (Supabase OAuth + PKCE).
 * Shows an honest "not set up yet" state when Google is not enabled in Supabase Auth: it never fakes a login.
 */
export const GoogleButton: React.FC<{ label: string; onError: (msg: string | null) => void }> = ({ label, onError }) => {
  const { signInWithGoogle } = useAuth();
  const { auth } = useSiteSettings();
  const providers = useAuthProviders();
  const availability = googleAvailability(auth.googleEnabled, providers);
  const [busy, setBusy] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const disabled = busy || availability === 'not_configured' || availability === 'disabled_by_admin';

  const press = async () => {
    onError(null);
    Haptics.selectionAsync().catch(() => undefined);
    setBusy(true);
    try {
      await signInWithGoogle(); // (auth)/_layout redirects to the tabs once the session is stored
    } catch (e: any) {
      onError(e?.message || 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };
  const animate = (to: number) => Animated.spring(scale, { toValue: to, friction: 6, tension: 140, useNativeDriver: true }).start();

  if (availability === 'disabled_by_admin') return null;

  return (
    <View style={{ gap: 6 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={press}
          onPressIn={() => animate(0.97)}
          onPressOut={() => animate(1)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled, busy }}
          accessibilityLabel={availability === 'not_configured' ? 'Google sign-in is not set up yet' : googleButtonLabel(label)}
          style={[styles.btn, disabled && !busy && { opacity: 0.55 }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              {GOOGLE_MARK ? <Image source={GOOGLE_MARK} style={{ width: 20, height: 20 }} contentFit="contain" /> : <Ionicons name="logo-google" size={19} color="#1F1F1F" />}
              <Text style={styles.label} numberOfLines={1}>{googleButtonLabel(label)}</Text>
            </>
          )}
        </Pressable>
      </Animated.View>
      {availability === 'not_configured' && (
        <Text style={[type.small, { textAlign: 'center', color: colors.warning }]}>Google sign-in is not set up yet. Please use your email for now.</Text>
      )}
    </View>
  );
};

export const OrDivider: React.FC<{ label: string }> = ({ label }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 }} accessibilityRole="text">
    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    <Text style={[type.small, { color: colors.subtle, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: fonts.bodySemi, fontSize: 11.5 }]}>{label}</Text>
    <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
  </View>
);

const styles = StyleSheet.create({
  btn: {
    minHeight: 54, borderRadius: radius.pill, borderWidth: 1, borderColor: '#747775', backgroundColor: colors.white,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20,
    shadowColor: '#0B1220', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
  label: { fontFamily: fonts.bodySemi, fontSize: 15.5, color: '#1F1F1F', flexShrink: 1 },
});
