import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useBundle, useEnrollments } from '@/hooks/queries';
import { ScreenHeader } from '@/components/Chrome';
import { CourseRow, Thumb } from '@/components/CourseCards';
import { Badge, Button, ErrorState, Loading } from '@/components/ui';
import { colors, fonts, radius, shadowLg, type } from '@/theme';
import { formatPrice } from '@/utils/format';
import { bundleOwnership, bundleSavings } from '@/logic/bundles';
import { friendlyMessage } from '@/logic/apiErrors';

export default function BundleDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const bundle = useBundle(id);
  const enrollments = useEnrollments();
  const owned = useMemo(() => new Set((enrollments.data || []).map((e) => e.courseId)), [enrollments.data]);
  const [showAll, setShowAll] = useState(false);

  if (bundle.isLoading) return <View style={{ flex: 1 }}><ScreenHeader /><Loading label="Loading bundle…" /></View>;
  if (!bundle.data) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader />
        <ErrorState message={bundle.error ? friendlyMessage(bundle.error) : 'This bundle is no longer available.'} onRetry={() => bundle.refetch()} />
      </View>
    );
  }
  const b = bundle.data;
  const s = bundleSavings(b);
  const own = bundleOwnership(b, owned);
  const totalLessons = b.courses.reduce((n, c) => n + c.totalLessons, 0);
  const totalHours = b.courses.reduce((n, c) => n + c.durationHours, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }}>
        <View>
          <Thumb uri={b.thumbnail} style={{ width: '100%', aspectRatio: 16 / 10 }} radius={0} />
          <LinearGradient colors={['rgba(11,18,32,0.35)', 'transparent', 'rgba(11,18,32,0.7)']} style={StyleSheet.absoluteFill} />
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none"><ScreenHeader transparent /></View>
        </View>
        <View style={styles.body}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Badge label="Course bundle" />
            {s.percent > 0 && <Badge label={`Save ${s.percent}%`} tone="accent" />}
          </View>
          <Text style={[type.h1, { marginTop: 12 }]}>{b.title}</Text>
          {!!b.subtitle && <Text style={[type.body, { marginTop: 8, fontSize: 16, color: colors.muted }]}>{b.subtitle}</Text>}

          <View style={styles.stats}>
            <Stat icon="library-outline" label={`${b.courses.length} courses`} />
            <Stat icon="play-circle-outline" label={`${totalLessons} lessons`} />
            {totalHours > 0 && <Stat icon="time-outline" label={`${Math.round(totalHours)} hours`} />}
          </View>

          <View style={styles.priceBox}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.ink }}>{formatPrice(b.price)}</Text>
              {s.amount > 0 && <Text style={styles.strike}>{formatPrice(b.coursesValue)}</Text>}
            </View>
            {s.amount > 0 && <Text style={[type.bodyStrong, { color: colors.success }]}>You save {formatPrice(s.amount)} compared with buying each course</Text>}
            {own.ownedCount > 0 && (
              <Text style={[type.small, { color: own.ownsAll ? colors.success : colors.warning }]}>
                {own.ownsAll ? 'You already own every course in this bundle.' : `You already own ${own.ownedCount} of ${own.total} courses. The bundle price stays the same.`}
              </Text>
            )}
          </View>

          {!!b.description && (
            <View style={{ marginTop: 22 }}>
              <Text style={type.h2}>About this bundle</Text>
              <Text style={[type.body, { marginTop: 8 }]} numberOfLines={showAll ? undefined : 6}>{b.description}</Text>
              {b.description.length > 280 && (
                <Text onPress={() => setShowAll((v) => !v)} style={[type.smallStrong, { color: colors.primary, marginTop: 6 }]} accessibilityRole="button">{showAll ? 'Show less' : 'Read more'}</Text>
              )}
            </View>
          )}

          <View style={{ marginTop: 22, gap: 12 }}>
            <Text style={type.h2}>Included courses</Text>
            {b.courses.map((c) => <CourseRow key={c.id} course={c} enrolled={owned.has(c.id)} />)}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {own.ownsAll ? (
          <Button title="Go to My Learning" icon="library" onPress={() => router.push('/(tabs)/learning')} style={{ flex: 1 }} />
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.ink }}>{formatPrice(b.price)}</Text>
              <Text style={type.small}>{b.courses.length} courses · lifetime access</Text>
            </View>
            <Button title={b.price <= 0 ? 'Enroll free' : 'Buy bundle'} icon="cart-outline" size="md" onPress={() => router.push({ pathname: '/checkout/[id]', params: { id: b.id, kind: 'bundle' } })} />
          </>
        )}
      </View>
    </View>
  );
}

const Stat: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = ({ icon, label }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
    <Ionicons name={icon} size={15} color={colors.muted} />
    <Text style={type.smallStrong}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  body: { marginTop: -24, backgroundColor: colors.bg, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: 20, paddingTop: 22 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  priceBox: { marginTop: 18, padding: 16, gap: 6, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  strike: { fontFamily: fonts.body, fontSize: 16, color: colors.subtle, textDecorationLine: 'line-through' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 14, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, ...shadowLg },
});
