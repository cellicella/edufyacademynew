import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBundle, useCourse, useEnrollments } from '@/hooks/queries';
import { usePurchase } from '@/hooks/usePurchase';
import { ScreenHeader } from '@/components/Chrome';
import { Thumb } from '@/components/CourseCards';
import { RazorpayWebCheckout } from '@/components/RazorpayWebCheckout';
import { Button, ErrorState, Loading } from '@/components/ui';
import { colors, fonts, radius, type } from '@/theme';
import { discountPercent, formatPrice } from '@/utils/format';
import { bundleOwnership, bundleSavings } from '@/logic/bundles';
import { friendlyMessage } from '@/logic/apiErrors';

/**
 * Checkout for a single course (/checkout/<courseId>) or a bundle (/checkout/<bundleId>?kind=bundle).
 * Prices shown here are for information — the server always charges the database price.
 */
export default function Checkout() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const isBundle = kind === 'bundle';
  const insets = useSafeAreaInsets();
  const course = useCourse(isBundle ? undefined : id);
  const bundle = useBundle(isBundle ? id : undefined);
  const enrollments = useEnrollments();
  const owned = useMemo(() => new Set((enrollments.data || []).map((e) => e.courseId)), [enrollments.data]);

  const item = isBundle ? bundle.data : course.data;
  const courseIds = useMemo(() => (isBundle ? bundle.data?.courses.map((c) => c.id) || [] : course.data ? [course.data.id] : []), [isBundle, bundle.data, course.data]);
  const ownsAll = courseIds.length > 0 && courseIds.every((cid) => owned.has(cid));

  const purchase = usePurchase(
    item ? (isBundle ? { bundleId: item.id } : { courseId: item.id }) : null,
    { title: item?.title || '', image: item?.thumbnail },
    (ids) => courseIds.length > 0 && courseIds.every((cid) => ids.includes(cid))
  );

  const q = isBundle ? bundle : course;
  if (q.isLoading) return <View style={{ flex: 1 }}><ScreenHeader title="Checkout" /><Loading /></View>;
  if (!item) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Checkout" />
        <ErrorState message={q.error ? friendlyMessage(q.error) : isBundle ? 'This bundle is not available.' : 'Course not found.'} onRetry={() => q.refetch()} />
      </View>
    );
  }

  if (purchase.phase === 'success' || (ownsAll && purchase.phase === 'review')) {
    const first = courseIds[0];
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="" />
        <View style={styles.result}>
          <View style={[styles.resultIcon, { backgroundColor: colors.successSoft }]}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          </View>
          <Text style={[type.h1, { textAlign: 'center' }]}>
            {purchase.phase === 'success' ? 'You’re enrolled!' : isBundle ? 'You already own every course in this bundle' : 'You already own this course'}
          </Text>
          <Text style={[type.body, { textAlign: 'center', color: colors.muted }]}>
            {isBundle ? `All ${courseIds.length} courses in ${item.title} are in My Learning` : `${item.title} is now in My Learning`} — on this app and on the Edufy website.
          </Text>
          {first && !isBundle && <Button title="Start learning" icon="play" onPress={() => router.replace(`/learn/${first}`)} style={{ alignSelf: 'stretch', marginTop: 12 }} />}
          <Button title="Go to My Learning" variant={isBundle ? 'primary' : 'ghost'} onPress={() => router.replace('/(tabs)/learning')} style={{ alignSelf: 'stretch', marginTop: isBundle ? 12 : 0 }} />
        </View>
      </View>
    );
  }

  const price = item.price;
  let originalPrice: number;
  let note: string;
  let ownershipNote: string | null = null;
  if (isBundle && bundle.data) {
    originalPrice = bundle.data.coursesValue;
    const own = bundleOwnership(bundle.data, owned);
    note = `${bundle.data.courses.length} courses · price confirmed by Edufy’s server`;
    if (own.ownedCount > 0) {
      ownershipNote = `You already own ${own.ownedCount} of ${own.total} courses. The bundle price stays the same; you’ll get access to the other ${own.missing.length}.`;
    }
  } else {
    originalPrice = Math.max(course.data!.originalPrice, price);
    note = 'The final amount is confirmed by Edufy’s server from the course price.';
  }
  const saving = isBundle ? bundleSavings({ price, coursesValue: originalPrice }) : { amount: Math.max(0, originalPrice - price), percent: discountPercent(price, originalPrice) };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Checkout" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 170 }}>
        <View style={styles.card}>
          <Thumb uri={item.thumbnail} style={{ width: 92, height: 92 }} radius={radius.md} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.eyebrow, { color: colors.secondary }]}>{isBundle ? 'Course bundle' : course.data!.category}</Text>
            <Text style={[type.h3, { fontSize: 16 }]} numberOfLines={3}>{item.title}</Text>
            <Text style={type.small}>{isBundle ? `${courseIds.length} courses included` : course.data!.instructor.name}</Text>
          </View>
        </View>

        {isBundle && bundle.data && (
          <View style={styles.card2}>
            <Text style={type.h3}>Included courses</Text>
            {bundle.data.courses.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name={owned.has(c.id) ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={owned.has(c.id) ? colors.success : colors.subtle} />
                <Text style={[type.body, { flex: 1 }]} numberOfLines={2}>{c.title}</Text>
                <Text style={type.small}>{owned.has(c.id) ? 'Owned' : formatPrice(c.price)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card2}>
          <Text style={type.h3}>Order summary</Text>
          <Row label={isBundle ? 'Courses bought separately' : 'Original price'} value={formatPrice(originalPrice)} />
          {saving.amount > 0 && <Row label={`You save (${saving.percent}%)`} value={`− ${formatPrice(saving.amount)}`} tone={colors.success} />}
          <View style={{ height: 1, backgroundColor: colors.hairline, marginVertical: 4 }} />
          <Row label="Total" value={formatPrice(price)} strong />
          <Text style={type.small}>{note}</Text>
          {!!ownershipNote && (
            <View style={styles.info}>
              <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
              <Text style={[type.small, { color: colors.warning, flex: 1 }]}>{ownershipNote}</Text>
            </View>
          )}
        </View>

        <View style={styles.card2}>
          {[
            ['infinite-outline', 'Lifetime access to all lessons'],
            ['phone-portrait-outline', 'Learn on the app and the website'],
            ['ribbon-outline', 'Certificate for every course you complete'],
          ].map(([icon, text]) => (
            <View key={text} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Ionicons name={icon as any} size={19} color={colors.primary} />
              <Text style={type.body}>{text}</Text>
            </View>
          ))}
        </View>

        {(purchase.phase === 'failed' || purchase.phase === 'verify_failed') && !!purchase.error && (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={20} color={colors.danger} />
            <Text style={[type.body, { color: colors.danger, flex: 1 }]}>{purchase.error}</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <Ionicons name="lock-closed" size={13} color={colors.muted} />
          <Text style={type.small}>Secure payment by Razorpay · UPI, cards, netbanking</Text>
        </View>
        {purchase.busy && !!purchase.step && <Text style={[type.small, { textAlign: 'center', color: colors.primary }]}>{purchase.step}</Text>}
        {purchase.phase === 'verify_failed' && purchase.pendingVerification ? (
          <Button title="Retry verification" icon="refresh" onPress={purchase.retryVerification} />
        ) : (
          <Button
            title={purchase.phase === 'verifying' ? 'Verifying payment…' : purchase.phase === 'failed' ? 'Try again' : price <= 0 ? 'Enroll for free' : `Pay ${formatPrice(price)}`}
            icon={price <= 0 ? 'add-circle-outline' : 'lock-closed-outline'}
            loading={purchase.busy}
            onPress={purchase.pay}
          />
        )}
      </View>

      <RazorpayWebCheckout visible={!!purchase.webOptions} options={purchase.webOptions} onSuccess={purchase.verify} onFailure={purchase.fail} />
    </View>
  );
}

const Row: React.FC<{ label: string; value: string; strong?: boolean; tone?: string }> = ({ label, value, strong, tone }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
    <Text style={[strong ? type.bodyStrong : type.body, { flex: 1 }]}>{label}</Text>
    <Text style={[strong ? { fontFamily: fonts.display, fontSize: 20, color: colors.ink } : type.bodyStrong, tone ? { color: tone } : null]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 14, padding: 12, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  card2: { gap: 12, padding: 18, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  info: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: radius.sm, backgroundColor: colors.warningSoft },
  error: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingTop: 12, gap: 10, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
  result: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  resultIcon: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
