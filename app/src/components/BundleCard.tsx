import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Bundle, bundleSavings } from '@/logic/bundles';
import { Thumb } from './CourseCards';
import { Badge } from './ui';
import { colors, fonts, radius, shadow, type } from '@/theme';
import { formatPrice } from '@/utils/format';

/** Bundle card: stacked course thumbnails, price, savings and owned state. */
export const BundleCard = React.memo(function BundleCard({ bundle, width, ownedCount = 0 }: { bundle: Bundle; width?: number; ownedCount?: number }) {
  const s = bundleSavings(bundle);
  const ownsAll = ownedCount > 0 && ownedCount >= bundle.courses.length;
  return (
    <Pressable
      onPress={() => router.push(`/bundle/${bundle.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Bundle: ${bundle.title}, ${bundle.courses.length} courses, ${formatPrice(bundle.price)}`}
      style={({ pressed }) => [styles.card, width ? { width } : null, pressed && { opacity: 0.95, transform: [{ scale: 0.99 }] }]}
    >
      <View>
        <Thumb uri={bundle.thumbnail} style={styles.thumb} radius={radius.lg} />
        <LinearGradient colors={['transparent', 'rgba(11,18,32,0.75)']} style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />
        <View style={styles.badges}>
          <Badge label="Bundle" tone="dark" />
          {s.percent > 0 && <Badge label={`Save ${s.percent}%`} tone="accent" />}
        </View>
        <View style={styles.stack}>
          {bundle.courses.slice(0, 4).map((c, i) => (
            <View key={c.id} style={[styles.mini, { marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }]}>
              <Thumb uri={c.thumbnail} style={{ width: 30, height: 30 }} radius={8} />
            </View>
          ))}
          <Text style={styles.count}>{bundle.courses.length} courses</Text>
        </View>
      </View>
      <View style={{ padding: 12, gap: 6 }}>
        <Text style={[type.h3, { fontSize: 16 }]} numberOfLines={2}>{bundle.title}</Text>
        {!!bundle.subtitle && <Text style={type.small} numberOfLines={2}>{bundle.subtitle}</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.ink }}>{formatPrice(bundle.price)}</Text>
          {s.amount > 0 && <Text style={styles.strike}>{formatPrice(bundle.coursesValue)}</Text>}
        </View>
        {ownedCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={[type.small, { color: colors.success }]}>{ownsAll ? 'You own all courses' : `You own ${ownedCount} of ${bundle.courses.length}`}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 6, ...shadow },
  thumb: { width: '100%', aspectRatio: 16 / 9 },
  badges: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', gap: 6 },
  stack: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center' },
  mini: { borderWidth: 2, borderColor: colors.white, borderRadius: 10 },
  count: { marginLeft: 8, fontFamily: fonts.bodySemi, fontSize: 13, color: colors.white },
  strike: { fontFamily: fonts.body, fontSize: 13, color: colors.subtle, textDecorationLine: 'line-through' },
});
