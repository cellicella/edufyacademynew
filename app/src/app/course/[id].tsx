import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCourse, useIsEnrolled } from '@/hooks/queries';
import { useRecentlyViewed } from '@/hooks/engagement';
import { PriceTag, Thumb } from '@/components/CourseCards';
import { Curriculum } from '@/components/Curriculum';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ScreenHeader } from '@/components/Chrome';
import { Avatar, Badge, Button, ErrorState, Loading, Skeleton } from '@/components/ui';
import { colors, fonts, radius, shadowLg, type } from '@/theme';
import { formatDuration, formatMinutes } from '@/utils/format';
import { resolveVideo } from '@/utils/video';
import { friendlyMessage } from '@/logic/apiErrors';

export default function CourseDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const course = useCourse(id, { fromList: true }); // drawn instantly from the catalogue, curriculum follows
  const { enrolled, isLoading: enrolLoading } = useIsEnrolled(course.data?.id);
  const [showAllDesc, setShowAllDesc] = useState(false);
  const [preview, setPreview] = useState(false);
  const { add: addRecent } = useRecentlyViewed();
  const curriculumLoading = course.isPlaceholderData;
  const loadedId = curriculumLoading ? undefined : course.data?.id;
  // "Recently viewed" on Home (stored on this device only)
  useEffect(() => {
    if (loadedId) addRecent(loadedId);
  }, [loadedId, addRecent]);

  if (course.isLoading) return <View style={{ flex: 1 }}><ScreenHeader /><Loading label="Loading course…" /></View>;
  // A failed background refresh keeps showing the cached course; the error screen is only for no data at all
  if (!course.data) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader />
        <ErrorState message={course.error ? friendlyMessage(course.error) : 'This course is not available.'} onRetry={() => course.refetch()} />
      </View>
    );
  }

  const c = course.data;
  const previewVideo = resolveVideo(c.previewVideoUrl);
  const totalMinutes = c.sections.reduce((n, s) => n + s.lessons.reduce((m, l) => m + (l.durationMinutes || 0), 0), 0);
  const firstPreview = c.sections.flatMap((s) => s.lessons).find((l) => l.isFreePreview && l.accessible);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Hero */}
        <View>
          <Thumb uri={c.thumbnail} style={{ width: '100%', aspectRatio: 16 / 11 }} radius={0} />
          <LinearGradient colors={['rgba(11,18,32,0.35)', 'transparent', 'rgba(11,18,32,0.55)']} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { top: 0 }]} pointerEvents="box-none">
            <ScreenHeader transparent />
          </View>
          {previewVideo && (
            <Pressable onPress={() => setPreview(true)} style={styles.previewBtn} accessibilityRole="button" accessibilityLabel="Play course preview">
              <View style={styles.playCircle}>
                <Ionicons name="play" size={26} color={colors.primary} style={{ marginLeft: 3 }} />
              </View>
              <Text style={styles.previewText}>Preview this course</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.body}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Badge label={c.category} />
            <Badge label={c.level} tone="accent" />
            {c.bestseller && <Badge label="Bestseller" tone="warning" />}
          </View>
          <Text style={[type.h1, { marginTop: 12 }]}>{c.title}</Text>
          {!!c.subtitle && <Text style={[type.body, { marginTop: 8, fontSize: 16, color: colors.muted }]}>{c.subtitle}</Text>}

          <View style={styles.statsRow}>
            {c.reviewCount > 0 ? (
              <Stat icon="star" iconColor="#F59E0B" label={`${c.rating.toFixed(1)} (${c.reviewCount})`} />
            ) : (
              <Stat icon="sparkles-outline" label="New" />
            )}
            <Stat icon="people-outline" label={`${c.enrolledCount.toLocaleString('en-IN')} learners`} />
            <Stat icon="time-outline" label={totalMinutes ? formatMinutes(totalMinutes) : formatDuration(c.durationHours)} />
            <Stat icon="play-circle-outline" label={`${c.totalLessons} lessons`} />
            <Stat icon="globe-outline" label={c.language} />
          </View>

          <View style={styles.instructorMini}>
            <Avatar uri={c.instructor.avatar} name={c.instructor.name} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={type.small}>Created by</Text>
              <Text style={type.bodyStrong}>{c.instructor.name}</Text>
            </View>
          </View>

          {c.learningOutcomes.length > 0 && (
            <View style={styles.box}>
              <Text style={type.h2}>What you’ll learn</Text>
              <View style={{ gap: 10, marginTop: 12 }}>
                {c.learningOutcomes.map((o, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                    <Ionicons name="checkmark-circle" size={19} color={colors.success} style={{ marginTop: 2 }} />
                    <Text style={[type.body, { flex: 1 }]}>{o}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {!!c.description && (
            <View style={{ marginTop: 26 }}>
              <Text style={type.h2}>About this course</Text>
              <Text style={[type.body, { marginTop: 10 }]} numberOfLines={showAllDesc ? undefined : 6}>{c.description}</Text>
              {c.description.length > 280 && (
                <Text onPress={() => setShowAllDesc((v) => !v)} style={[type.smallStrong, { color: colors.primary, marginTop: 6 }]} accessibilityRole="button">
                  {showAllDesc ? 'Show less' : 'Read more'}
                </Text>
              )}
            </View>
          )}

          <View style={{ marginTop: 26 }}>
            <Text style={type.h2}>Course curriculum</Text>
            <Text style={[type.small, { marginTop: 4, marginBottom: 12 }]}>
              {curriculumLoading ? `${c.totalLessons} lessons` : `${c.sections.length} sections · ${c.totalLessons} lessons · ${formatMinutes(totalMinutes)} total`}
            </Text>
            {curriculumLoading ? (
              <View style={{ gap: 10 }} accessibilityLabel="Loading the curriculum">
                {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 56, borderRadius: radius.lg }} />)}
              </View>
            ) : c.sections.length ? (
              <Curriculum
                sections={c.sections}
                canOpen={(l) => enrolled || (l.isFreePreview && l.accessible)}
                onOpen={(l) => router.push({ pathname: '/learn/[courseId]', params: { courseId: c.id, lesson: l.id } })}
              />
            ) : (
              <Text style={type.body}>The curriculum is being prepared.</Text>
            )}
          </View>

          {c.requirements.length > 0 && (
            <View style={{ marginTop: 26 }}>
              <Text style={type.h2}>Requirements</Text>
              <View style={{ gap: 8, marginTop: 10 }}>
                {c.requirements.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                    <Text style={[type.body, { color: colors.primary }]}>•</Text>
                    <Text style={[type.body, { flex: 1 }]}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {c.targetAudience.length > 0 && (
            <View style={{ marginTop: 26 }}>
              <Text style={type.h2}>Who this course is for</Text>
              <View style={{ gap: 8, marginTop: 10 }}>
                {c.targetAudience.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                    <Ionicons name="person-outline" size={16} color={colors.secondary} style={{ marginTop: 3 }} />
                    <Text style={[type.body, { flex: 1 }]}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={[styles.box, { marginTop: 26 }]}>
            <Text style={type.eyebrow}>Your instructor</Text>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 12 }}>
              <Avatar uri={c.instructor.avatar} name={c.instructor.name} size={64} />
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{c.instructor.name}</Text>
                {!!c.instructor.headline && <Text style={type.small}>{c.instructor.headline}</Text>}
              </View>
            </View>
            {!!c.instructor.bio && <Text style={[type.body, { marginTop: 12 }]}>{c.instructor.bio}</Text>}
          </View>
        </View>
      </ScrollView>

      {/* Sticky purchase bar */}
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {enrolled ? (
          <Button title="Start learning" icon="play" onPress={() => router.push(`/learn/${c.id}`)} style={{ flex: 1 }} />
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <PriceTag price={c.price} original={c.originalPrice} />
              <Text style={type.small}>Lifetime access · Certificate</Text>
            </View>
            {firstPreview && <Button title="Preview" variant="outline" size="md" onPress={() => router.push({ pathname: '/learn/[courseId]', params: { courseId: c.id, lesson: firstPreview.id } })} />}
            <Button
              title={c.price <= 0 ? 'Enroll free' : 'Buy now'}
              icon={c.price <= 0 ? 'add-circle-outline' : 'cart-outline'}
              size="md"
              loading={enrolLoading}
              onPress={() => router.push(`/checkout/${c.id}`)}
            />
          </>
        )}
      </View>

      <Modal visible={preview} animationType="fade" transparent onRequestClose={() => setPreview(false)} supportedOrientations={['portrait', 'landscape']}>
        <View style={styles.modal}>
          <View style={{ width: '100%' }}>
            <View style={styles.modalHead}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.body, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>Course preview</Text>
                <Text style={{ fontFamily: fonts.displayBold, color: colors.white, fontSize: 17 }} numberOfLines={1}>{c.title}</Text>
              </View>
              <Pressable onPress={() => setPreview(false)} style={styles.close} accessibilityLabel="Close preview" accessibilityRole="button">
                <Ionicons name="close" size={22} color={colors.white} />
              </Pressable>
            </View>
            {previewVideo && <VideoPlayer video={previewVideo} title={`${c.title} preview`} autoPlay />}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const Stat: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; iconColor?: string }> = ({ icon, label, iconColor = colors.muted }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
    <Ionicons name={icon} size={15} color={iconColor} />
    <Text style={type.smallStrong}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  previewBtn: { position: 'absolute', alignSelf: 'center', top: '34%', alignItems: 'center', gap: 8 },
  playCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadowLg },
  previewText: { fontFamily: fonts.bodySemi, color: colors.white, fontSize: 14, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  body: { marginTop: -24, backgroundColor: colors.bg, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: 20, paddingTop: 22 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 16 },
  instructorMini: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 12, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  box: { marginTop: 22, padding: 18, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 14, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, ...shadowLg,
  },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
