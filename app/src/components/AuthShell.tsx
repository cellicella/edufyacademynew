import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Logo, ScreenHeader } from './Chrome';
import { colors, fonts, gradients, radius, shadowLg, type } from '@/theme';

/**
 * Premium authentication layout: brand gradient with the Edufy logo, then a rounded white sheet that slides in.
 * Keyboard-aware and scrollable on small phones; respects "reduce motion" and large font sizes.
 */
export const AuthShell: React.FC<{ title: string; subtitle?: string; back?: boolean; eyebrow?: string; children: React.ReactNode }> = ({ title, subtitle, back, eyebrow, children }) => {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          fade.setValue(1);
          rise.setValue(0);
          logoScale.setValue(1);
          return;
        }
        Animated.parallel([
          Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(rise, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
        ]).start();
      });
    return () => {
      cancelled = true;
    };
  }, [fade, rise, logoScale]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={gradients.brandDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={[styles.orb, { width: 300, height: 300, top: -120, right: -100 }]} />
            <View style={[styles.orb, { width: 180, height: 180, bottom: -40, left: -70, borderColor: 'rgba(255,255,255,0.06)' }]} />
            {back ? <ScreenHeader transparent /> : <SafeAreaView edges={['top']} />}
            <Animated.View style={[styles.heroInner, { paddingTop: back ? 4 : 20, opacity: fade, transform: [{ scale: logoScale }] }]}>
              <View style={styles.logoTile}>
                <Logo size={38} light subtitle={false} />
              </View>
              <View style={styles.trustRow}>
                <Ionicons name="shield-checkmark" size={14} color="rgba(255,255,255,0.85)" />
                <Text style={styles.trustText}>Secure sign-in · Same account on web and app</Text>
              </View>
            </Animated.View>
          </LinearGradient>

          <Animated.View style={[styles.sheet, { opacity: fade, transform: [{ translateY: rise }] }]}>
            {!!eyebrow && <Text style={[type.eyebrow, { marginBottom: 6 }]}>{eyebrow}</Text>}
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            {!!subtitle && <Text style={[type.body, { color: colors.muted, marginTop: 6 }]}>{subtitle}</Text>}
            <View style={{ marginTop: 22, gap: 16 }}>{children}</View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export const FormMessage: React.FC<{ text: string | null; tone?: 'error' | 'success' | 'info' }> = ({ text, tone = 'error' }) => {
  if (!text) return null;
  const c = tone === 'success' ? { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle' as const } : tone === 'info' ? { bg: colors.primarySoft, fg: colors.primaryDark, icon: 'information-circle' as const } : { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' as const };
  return (
    <View style={[styles.msg, { backgroundColor: c.bg }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Ionicons name={c.icon} size={18} color={c.fg} style={{ marginTop: 1 }} />
      <Text style={[type.small, { color: c.fg, fontSize: 14, flex: 1, lineHeight: 20 }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { overflow: 'hidden', paddingBottom: 54 },
  orb: { position: 'absolute', borderRadius: 999, borderWidth: 34, borderColor: 'rgba(255,255,255,0.08)' },
  heroInner: { alignItems: 'center', paddingHorizontal: 24, gap: 14 },
  logoTile: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.xl, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' },
  sheet: { flex: 1, marginTop: -30, backgroundColor: colors.white, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40, ...shadowLg },
  title: { fontFamily: fonts.display, fontSize: 27, lineHeight: 33, color: colors.ink, letterSpacing: -0.6 },
  msg: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.sm },
});
