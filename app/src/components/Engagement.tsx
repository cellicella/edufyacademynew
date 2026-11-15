import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, AppState, FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, PressableProps, StyleProp,
  StyleSheet, Text, View, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, fonts, gradients, radius, shadow, type } from '@/theme';
import { Banner, Offer, offerCountdown } from '@/logic/engagement';
import { itemTarget } from '@/logic/deepLinks';
import { openTarget } from '@/lib/navigation';

/* ------------------------------------------------------------------ PressableScale */
/** Pressable with a soft spring scale on press (native driver, cheap). */
export const PressableScale: React.FC<PressableProps & { style?: StyleProp<ViewStyle>; outerStyle?: StyleProp<ViewStyle>; scaleTo?: number; children: React.ReactNode }> = ({
  style, outerStyle, scaleTo = 0.97, children, onPressIn, onPressOut, ...rest
}) => {
  const s = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      {...rest}
      style={outerStyle}
      onPressIn={(e) => {
        Animated.spring(s, { toValue: scaleTo, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(s, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
};

/* ------------------------------------------------------------------ CountBadge */
/** Unread badge that pops when the number changes. */
export const CountBadge: React.FC<{ count: number; style?: StyleProp<ViewStyle> }> = ({ count, style }) => {
  const s = useRef(new Animated.Value(count > 0 ? 1 : 0)).current;
  const prev = useRef(count);
  useEffect(() => {
    if (count > 0) {
      s.setValue(prev.current === 0 ? 0 : 0.6);
      Animated.spring(s, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }).start();
    } else {
      Animated.timing(s, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
    prev.current = count;
  }, [count, s]);
  return (
    <Animated.View pointerEvents="none" style={[styles.badge, style, { transform: [{ scale: s }], opacity: s }]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </Animated.View>
  );
};

/* ------------------------------------------------------------------ BannerCarousel */
export interface SlideItem {
  key: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string | null;
  pill?: string | null;
  cta?: string | null;
  onPress?: () => void;
}

export const slideFromBanner = (b: Banner): SlideItem => {
  const target = itemTarget(b);
  return {
    key: `b-${b.id}`, title: b.title, subtitle: b.description || b.subtitle || null, pill: b.description ? b.subtitle || null : null, imageUrl: b.imageUrl,
    cta: target ? b.ctaText || 'Explore' : null,
    onPress: target ? () => openTarget(target) : undefined,
  };
};

const AUTO_MS = 4500;

/**
 * Auto-sliding banner carousel with swipe, pagination dots and parallax-free cross-fade text.
 * Auto-slide pauses while the user touches it, when the screen is not focused, when the app is in
 * the background, and when "Reduce motion" is enabled.
 */
export const BannerCarousel: React.FC<{ items: SlideItem[]; width: number; height?: number }> = ({ items, width, height = 196 }) => {
  const ref = useRef<FlatList<SlideItem>>(null);
  const x = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const touching = useRef(false);
  const [focused, setFocused] = useState(true);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [reduceMotion, setReduceMotion] = useState(false);
  const gap = 12;
  const step = width + gap;

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const rm = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      sub.remove();
      rm.remove();
    };
  }, []);

  useEffect(() => {
    if (items.length < 2 || !focused || !active || reduceMotion) return;
    const t = setInterval(() => {
      if (touching.current) return;
      const next = (indexRef.current + 1) % items.length;
      ref.current?.scrollToOffset({ offset: next * step, animated: true });
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [items.length, focused, active, reduceMotion, step]);

  // Keep index valid when the list shrinks
  useEffect(() => {
    if (index >= items.length) {
      indexRef.current = 0;
      setIndex(0);
      ref.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [items.length, index]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.x / step)));
    indexRef.current = i;
    setIndex(i);
  };

  if (!items.length) return null;
  return (
    <View>
      <Animated.FlatList
        ref={ref as any}
        horizontal
        data={items}
        keyExtractor={(i) => i.key}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: 20, gap }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
        onScrollBeginDrag={() => (touching.current = true)}
        onScrollEndDrag={() => (touching.current = false)}
        getItemLayout={(_, i) => ({ length: step, offset: step * i, index: i })}
        renderItem={({ item, index: i }) => {
          const scale = x.interpolate({ inputRange: [(i - 1) * step, i * step, (i + 1) * step], outputRange: [0.94, 1, 0.94], extrapolate: 'clamp' });
          return (
            <Animated.View style={{ width, height, transform: [{ scale }] }}>
              <Slide item={item} height={height} onTouch={(v) => (touching.current = v)} />
            </Animated.View>
          );
        }}
      />
      {items.length > 1 && (
        <View style={styles.dots} accessibilityRole="adjustable" accessibilityLabel={`Banner ${index + 1} of ${items.length}`}>
          {items.map((it, i) => {
            const w = x.interpolate({ inputRange: [(i - 1) * step, i * step, (i + 1) * step], outputRange: [6, 22, 6], extrapolate: 'clamp' });
            const o = x.interpolate({ inputRange: [(i - 1) * step, i * step, (i + 1) * step], outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
            // width can't use the native driver; dots use a scaleX transform instead
            return (
              <Animated.View
                key={it.key}
                style={[styles.dot, { opacity: o, transform: [{ scaleX: w.interpolate({ inputRange: [6, 22], outputRange: [1, 3.6] }) }] }]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};

const Slide: React.FC<{ item: SlideItem; height: number; onTouch: (v: boolean) => void }> = React.memo(({ item, height, onTouch }) => {
  const [failed, setFailed] = useState(false);
  return (
    <PressableScale
      onPress={() => {
        if (!item.onPress) return;
        Haptics.selectionAsync().catch(() => undefined);
        item.onPress();
      }}
      onPressIn={() => onTouch(true)}
      onPressOut={() => onTouch(false)}
      disabled={!item.onPress}
      scaleTo={0.985}
      style={[styles.slide, shadow, { height }]}
      accessibilityRole={item.onPress ? 'button' : 'image'}
      accessibilityLabel={[item.pill, item.title, item.subtitle].filter(Boolean).join('. ')}
    >
      <LinearGradient colors={gradients.brandDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {item.imageUrl && !failed && (
        <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} onError={() => setFailed(true)} recyclingKey={item.imageUrl} />
      )}
      {(!item.imageUrl || failed) && (
        <View style={styles.slideArt} pointerEvents="none">
          <View style={[styles.orb, { width: 180, height: 180, right: -40, top: -50, backgroundColor: 'rgba(82,113,255,0.45)' }]} />
          <View style={[styles.orb, { width: 120, height: 120, right: 60, bottom: -50, backgroundColor: 'rgba(94,23,235,0.45)' }]} />
          <Ionicons name="school" size={64} color="rgba(255,255,255,0.18)" style={{ position: 'absolute', right: 22, top: 22 }} />
        </View>
      )}
      <LinearGradient colors={['rgba(11,18,32,0)', 'rgba(11,18,32,0.25)', 'rgba(11,18,32,0.88)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, justifyContent: 'flex-end', padding: 18, gap: 6 }}>
        {!!item.pill && (
          <View style={styles.pill}><Text style={styles.pillText} numberOfLines={1}>{item.pill}</Text></View>
        )}
        <Text style={styles.slideTitle} numberOfLines={2}>{item.title}</Text>
        {!!item.subtitle && <Text style={styles.slideSub} numberOfLines={2}>{item.subtitle}</Text>}
        {!!item.cta && (
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{item.cta}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
          </View>
        )}
      </View>
    </PressableScale>
  );
});

/* ------------------------------------------------------------------ OfferCard */
export const OfferCard: React.FC<{ offer: Offer; width?: number; onPress: () => void }> = React.memo(({ offer, width, onPress }) => {
  const countdown = offerCountdown(offer.endsAt);
  return (
    <PressableScale onPress={onPress} style={[styles.offer, width ? { width } : null]} accessibilityRole="button" accessibilityLabel={`${offer.title}. ${offer.discountText || ''}. ${countdown || ''}`}>
      <LinearGradient colors={['#5E17EB', '#5271FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.offerArt}>
        {offer.imageUrl ? (
          <Image source={{ uri: offer.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <Ionicons name="pricetag" size={30} color="rgba(255,255,255,0.9)" />
        )}
        {!!offer.discountText && (
          <View style={styles.offerTag}><Text style={styles.offerTagText} numberOfLines={1}>{offer.discountText}</Text></View>
        )}
      </LinearGradient>
      <View style={{ padding: 12, gap: 4, flex: 1 }}>
        <Text style={[type.h3, { fontSize: 15.5, lineHeight: 21 }]} numberOfLines={2}>{offer.title}</Text>
        {!!offer.description && <Text style={type.small} numberOfLines={2}>{offer.description}</Text>}
        <View style={{ flex: 1 }} />
        {!!countdown && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <Ionicons name="time-outline" size={13} color={colors.accent} />
            <Text style={[type.smallStrong, { color: colors.accent }]}>{countdown}</Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
});

/* ------------------------------------------------------------------ Stagger */
/** Slide-up + fade entrance for list items (index-based delay, capped). */
export const SlideUp: React.FC<{ index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ index = 0, children, style }) => {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 380, delay: Math.min(index, 6) * 60, useNativeDriver: true }).start();
  }, [a, index]);
  return (
    <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white,
  },
  badgeText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 10.5 },
  slide: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.primary },
  slideArt: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 999 },
  slideTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26, color: colors.white, letterSpacing: -0.3 },
  slideSub: { fontFamily: fonts.bodyMedium, fontSize: 13.5, lineHeight: 19, color: 'rgba(255,255,255,0.88)' },
  pill: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.white },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.white, paddingHorizontal: 14, height: 32, borderRadius: radius.pill, marginTop: 4 },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 12, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  offer: { borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow },
  offerArt: { height: 104, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  offerTag: { position: 'absolute', left: 10, bottom: 10, backgroundColor: colors.white, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, maxWidth: '85%' },
  offerTagText: { fontFamily: fonts.bodyBold, fontSize: 12.5, color: colors.accent },
});
