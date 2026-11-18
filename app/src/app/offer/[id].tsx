import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOffer } from '@/hooks/engagement';
import { useBundle, useCourse } from '@/hooks/queries';
import { ScreenHeader } from '@/components/Chrome';
import { Button, EmptyState, ErrorState, FadeIn, Loading } from '@/components/ui';
import { PriceTag } from '@/components/CourseCards';
import { colors, fonts, radius, type } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { friendlyMessage } from '@/logic/apiErrors';
import { isLive, offerCountdown } from '@/logic/engagement';
import { itemTarget } from '@/logic/deepLinks';
import { openTarget } from '@/lib/navigation';
import { cdnImage } from '@/logic/cdnImage';

const TYPE_LABEL: Record<string, string> = {
  special: 'Special offer', limited_time: 'Limited-time offer', festival: 'Festival offer',
  bundle_discount: 'Bundle discount', course_discount: 'Course discount', campaign: 'Promotion',
};

export default function OfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const q = useOffer(id);
  const offer = q.data;
  const course = useCourse(offer?.linkType === 'course' ? offer.courseId || undefined : undefined);
  const bundle = useBundle(offer?.linkType === 'bundle' ? offer.bundleId || undefined : undefined);

  if (q.isLoading) return <View style={{ flex: 1 }}><ScreenHeader title="Offer" /><Loading /></View>;
  if (q.error && !q.data) return <View style={{ flex: 1 }}><ScreenHeader title="Offer" /><ErrorState message={friendlyMessage(q.error)} onRetry={() => q.refetch()} /></View>;
  // Not returned (expired, disabled or deleted — the database only serves live offers) or expired since caching
  if (!offer || !isLive(offer)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Offer" />
        <EmptyState icon="time-outline" title="This offer has ended" body="It’s no longer available. Check out the current offers and courses." action="See current offers" onAction={() => router.replace('/offers')} />
      </View>
    );
  }

  const target = itemTarget(offer);
  const countdown = offerCountdown(offer.endsAt);
  const cta = offer.linkType === 'course' ? 'View course' : offer.linkType === 'bundle' ? 'View bundle' : offer.linkType === 'url' ? 'Open offer' : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={TYPE_LABEL[offer.offerType] || 'Offer'} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 120 }}>
        <FadeIn>
          <LinearGradient colors={['#5E17EB', '#004AAD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            {offer.imageUrl && <Image source={{ uri: cdnImage(offer.imageUrl, 1080) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />}
            <LinearGradient colors={['rgba(11,18,32,0)', 'rgba(11,18,32,0.8)']} style={StyleSheet.absoluteFill} />
            <View style={{ flex: 1, justifyContent: 'flex-end', padding: 18, gap: 8 }}>
              {!!offer.discountText && <View style={styles.tag}><Text style={styles.tagText}>{offer.discountText}</Text></View>}
              <Text style={styles.title}>{offer.title}</Text>
            </View>
          </LinearGradient>
        </FadeIn>

        {!!countdown && (
          <View style={styles.timer}>
            <Ionicons name="time-outline" size={20} color={colors.accent} />
            <Text style={[type.bodyStrong, { color: colors.accent, flex: 1 }]}>{countdown}</Text>
            {offer.endsAt && <Text style={type.small}>until {formatDate(offer.endsAt)}</Text>}
          </View>
        )}

        {!!offer.description && <Text style={type.body}>{offer.description}</Text>}

        {course.data && (
          <View style={styles.card}>
            <Text style={type.eyebrow}>Included course</Text>
            <Text style={type.h3}>{course.data.title}</Text>
            <PriceTag price={course.data.price} original={course.data.originalPrice} />
          </View>
        )}
        {bundle.data && (
          <View style={styles.card}>
            <Text style={type.eyebrow}>Included bundle</Text>
            <Text style={type.h3}>{bundle.data.title}</Text>
            <Text style={type.small}>{bundle.data.courses.length} courses · {formatPrice(bundle.data.price)}</Text>
          </View>
        )}
        <Text style={type.small}>Prices shown in the app and at checkout are the final prices charged.</Text>
      </ScrollView>

      {target && cta && (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Button title={cta} icon="arrow-forward" onPress={() => openTarget(target)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 220, borderRadius: radius.xl, overflow: 'hidden' },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 13.5, color: colors.accent },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.white },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.accentSoft },
  card: { gap: 6, padding: 16, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, paddingTop: 12, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border },
});
