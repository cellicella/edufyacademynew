import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, PressableProps, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { colors, fonts, gradients, radius, type } from '@/theme';
import { initials } from '@/utils/format';

/* ------------------------------------------------------------------ Button */
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export const Button: React.FC<{
  title: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'md' | 'lg' | 'sm';
}> = ({ title, onPress, variant = 'primary', icon, loading, disabled, style, size = 'lg' }) => {
  const h = size === 'lg' ? 54 : size === 'md' ? 46 : 38;
  const fg = variant === 'primary' || variant === 'danger' ? colors.white : variant === 'secondary' ? colors.primaryDark : colors.primary;
  const inner = (
    <View style={[styles.btnInner, { height: h }]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={fg} />}
          <Text style={[type.button, { color: fg, fontSize: size === 'sm' ? 14 : 15.5 }]} numberOfLines={1}>{title}</Text>
        </>
      )}
    </View>
  );
  const isOff = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isOff, busy: !!loading }}
      disabled={isOff}
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        variant === 'secondary' && { backgroundColor: colors.primarySoft },
        variant === 'outline' && { borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        variant === 'danger' && { backgroundColor: colors.danger },
        { opacity: isOff ? 0.55 : pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] },
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.pill }}>
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </Pressable>
  );
};

/* ------------------------------------------------------------------ Inputs */
export const TextField: React.FC<TextInputProps & { label: string; icon?: keyof typeof Ionicons.glyphMap; error?: string | null; secure?: boolean; inputRef?: React.Ref<TextInputInstance> }> = ({
  label, icon, error, secure, style, inputRef, ...rest
}) => {
  const [hidden, setHidden] = useState(!!secure);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={type.smallStrong}>{label}</Text>
      <View style={[styles.field, focused && { borderColor: colors.primary, backgroundColor: colors.white }, !!error && { borderColor: colors.danger }]}>
        {icon && <Ionicons name={icon} size={19} color={focused ? colors.primary : colors.subtle} />}
        <TextInput
          ref={inputRef}
          placeholderTextColor={colors.subtle}
          secureTextEntry={hidden}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={[styles.fieldInput, style]}
          accessibilityLabel={label}
          {...rest}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.muted} />
          </Pressable>
        )}
      </View>
      {!!error && <Text style={[type.small, { color: colors.danger }]}>{error}</Text>}
    </View>
  );
};

export const SearchBar: React.FC<{ value: string; onChangeText: (v: string) => void; placeholder?: string; autoFocus?: boolean; onSubmit?: () => void }> = ({
  value, onChangeText, placeholder = 'Search courses', autoFocus, onSubmit,
}) => (
  <View style={styles.search}>
    <Ionicons name="search" size={19} color={colors.muted} />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.subtle}
      style={styles.fieldInput}
      returnKeyType="search"
      autoFocus={autoFocus}
      onSubmitEditing={onSubmit}
      accessibilityLabel="Search courses"
    />
    {!!value && (
      <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear search">
        <Ionicons name="close-circle" size={19} color={colors.subtle} />
      </Pressable>
    )}
  </View>
);

/* ------------------------------------------------------------------ Display */
export const ProgressBar: React.FC<{ percent: number; height?: number; track?: string }> = ({ percent, height = 6, track = colors.hairline }) => {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: Math.max(0, Math.min(100, percent)), duration: 600, useNativeDriver: false }).start();
  }, [percent, w]);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
      <Animated.View style={{ height, borderRadius: height, width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), backgroundColor: percent >= 100 ? colors.success : colors.primary }} />
    </View>
  );
};

export const SectionHeader: React.FC<{ title: string; eyebrow?: string; action?: string; onAction?: () => void }> = ({ title, eyebrow, action, onAction }) => (
  <View style={styles.sectionHeader}>
    <View style={{ flex: 1 }}>
      {!!eyebrow && <Text style={type.eyebrow}>{eyebrow}</Text>}
      <Text style={[type.h2, { marginTop: eyebrow ? 4 : 0 }]}>{title}</Text>
    </View>
    {!!action && (
      <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
        <Text style={[type.smallStrong, { color: colors.primary }]}>{action}</Text>
      </Pressable>
    )}
  </View>
);

export const Chip: React.FC<{ label: string; active?: boolean; onPress?: () => void; count?: number }> = ({ label, active, onPress, count }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: !!active }}
    style={({ pressed }) => [styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }, pressed && { opacity: 0.85 }]}
  >
    <Text style={[type.smallStrong, { color: active ? colors.white : colors.text }]}>{label}</Text>
    {count !== undefined && <Text style={[type.small, { color: active ? 'rgba(255,255,255,0.8)' : colors.subtle }]}>{count}</Text>}
  </Pressable>
);

export const Badge: React.FC<{ label: string; tone?: 'primary' | 'accent' | 'success' | 'warning' | 'dark' | 'danger' }> = ({ label, tone = 'primary' }) => {
  const map = {
    primary: [colors.primarySoft, colors.primaryDark],
    accent: [colors.accentSoft, colors.accent],
    success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
    dark: ['rgba(17,24,39,0.72)', colors.white],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ fontFamily: fonts.bodySemi, fontSize: 11.5, color: fg }}>{label}</Text>
    </View>
  );
};

export const Avatar: React.FC<{ uri?: string | null; name?: string | null; size?: number }> = ({ uri, name, size = 44 }) =>
  uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft }} contentFit="cover" transition={150} />
  ) : (
    <LinearGradient colors={gradients.brand} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.displayBold, color: colors.white, fontSize: size * 0.38 }}>{initials(name)}</Text>
    </LinearGradient>
  );

export const Card: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: PressableProps['onPress'] }> = ({ children, style, onPress }) =>
  onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  ) : (
    <View style={[styles.card, style]}>{children}</View>
  );

/* ------------------------------------------------------------------ States */
export const EmptyState: React.FC<{ icon: keyof typeof Ionicons.glyphMap; title: string; body?: string; action?: string; onAction?: () => void }> = ({
  icon, title, body, action, onAction,
}) => (
  <View style={styles.state}>
    <View style={styles.stateIcon}>
      <Ionicons name={icon} size={30} color={colors.primary} />
    </View>
    <Text style={[type.h3, { textAlign: 'center' }]}>{title}</Text>
    {!!body && <Text style={[type.body, { textAlign: 'center', color: colors.muted }]}>{body}</Text>}
    {!!action && <Button title={action} onPress={onAction} size="md" style={{ marginTop: 8, alignSelf: 'stretch' }} />}
  </View>
);

export const ErrorState: React.FC<{ message?: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <EmptyState icon="cloud-offline-outline" title="Couldn’t load this" body={message || 'Check your connection and try again.'} action={onRetry ? 'Try again' : undefined} onAction={onRetry} />
);

/**
 * Branded loader: the Edufy emblem on a softly pulsing plate, a spinning brand-colour arc around it
 * and three bouncing dots. Native-driver transforms only; calmer when "Reduce motion" is on.
 */
export const Loading: React.FC<{ label?: string }> = ({ label }) => {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    let loops: Animated.CompositeAnimation[] = [];
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((r) => {
        if (!alive) return;
        setReduce(r);
        loops = [
          Animated.loop(Animated.timing(spin, { toValue: 1, duration: r ? 2400 : 1100, easing: Easing.linear, useNativeDriver: true })),
        ];
        if (!r) {
          loops.push(
            Animated.loop(
              Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
              ])
            ),
            Animated.loop(
              Animated.stagger(
                160,
                dots.map((d) =>
                  Animated.sequence([
                    Animated.timing(d, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                    Animated.timing(d, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
                  ])
                )
              )
            )
          );
        }
        loops.forEach((l) => l.start());
      });
    return () => {
      alive = false;
      loops.forEach((l) => l.stop());
    };
  }, [spin, pulse, dots]);

  return (
    <View style={[styles.state, { paddingVertical: 60 }]} accessibilityRole="progressbar" accessibilityLabel={label || 'Loading'}>
      <View style={styles.loader}>
        <Animated.View style={[styles.loaderHalo, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }) }] }]} />
        <Animated.View style={[styles.loaderArc, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />
        <Animated.View style={[styles.loaderPlate, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }] }]}>
          <Image source={require('../../assets/images/logo.png')} style={{ width: 40, height: 40 }} contentFit="contain" />
        </Animated.View>
      </View>
      {!!label && <Text style={[type.small, { marginTop: 4 }]}>{label}</Text>}
      <View style={styles.loaderDots}>
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={[
              styles.loaderDot,
              { backgroundColor: [colors.primary, '#5271FF', '#5E17EB'][i] },
              !reduce && { opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

/** Skeleton placeholder with a soft moving shimmer (native-driver transform only). */
export const Skeleton: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => {
  const t = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 1300, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [t]);
  const band = Math.max(80, w * 0.6);
  return (
    <View
      style={[{ backgroundColor: colors.border, borderRadius: radius.md, overflow: 'hidden' }, style]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      {w > 0 && (
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: band, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-band, w] }) }] }}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
        </Animated.View>
      )}
    </View>
  );
};

/** Fade + rise entrance animation */
export const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }> = ({ children, delay = 0, style }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start();
  }, [a, delay]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  btn: { borderRadius: radius.pill, backgroundColor: colors.primary, overflow: 'hidden' },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 22 },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, paddingHorizontal: 16,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg,
  },
  fieldInput: { flex: 1, fontFamily: fonts.body, fontSize: 15.5, color: colors.ink, paddingVertical: 0 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, paddingHorizontal: 16,
    borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 15,
    borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
  },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  card: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16 },
  state: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 36 },
  loader: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  loaderHalo: { position: 'absolute', width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primarySoft },
  loaderArc: {
    position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 3,
    borderColor: 'transparent', borderTopColor: colors.primary, borderRightColor: '#5E17EB',
  },
  loaderPlate: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0B1220', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  loaderDots: { flexDirection: 'row', gap: 6, marginTop: 2, height: 14, alignItems: 'flex-end' },
  loaderDot: { width: 7, height: 7, borderRadius: 4 },
  stateIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
