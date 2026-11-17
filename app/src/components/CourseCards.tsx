import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, fonts, gradients, radius, shadow, type } from '@/theme';
import { Course } from '@/lib/types';
import { discountPercent, formatDuration, formatPrice } from '@/utils/format';
import { Badge, Button, ProgressBar } from './ui';
import { PressableScale } from './Engagement';
import { LearningItem } from '@/hooks/queries';
import { cdnImage } from '@/logic/cdnImage';

export const Thumb: React.FC<{ uri: string | null; style: any; radius?: number }> = ({ uri, style, radius: r = radius.lg }) =>
  uri ? (
    <Image source={{ uri: cdnImage(uri, 720) }} style={[style, { borderRadius: r, backgroundColor: colors.primarySoft }]} contentFit="cover" transition={200} recyclingKey={uri} />
  ) : (
    <LinearGradient colors={gradients.brand} style={[style, { borderRadius: r, alignItems: 'center', justifyContent: 'center' }]}>
      <Ionicons name="school" size={28} color="rgba(255,255,255,0.9)" />
    </LinearGradient>
  );

export const PriceTag: React.FC<{ price: number; original: number; size?: 'sm' | 'lg' }> = ({ price, original, size = 'sm' }) => {
  const off = discountPercent(price, original);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: size === 'lg' ? 28 : 17, color: colors.ink }}>{formatPrice(price)}</Text>
      {off > 0 && (
        <>
          <Text style={{ fontFamily: fonts.body, fontSize: size === 'lg' ? 15 : 13, color: colors.subtle, textDecorationLine: 'line-through' }}>
            {formatPrice(original)}
          </Text>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: size === 'lg' ? 14 : 12, color: colors.success }}>{off}% off</Text>
        </>
      )}
    </View>
  );
};

const Rating: React.FC<{ course: Course }> = ({ course }) =>
  course.reviewCount > 0 ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name="star" size={13} color="#F59E0B" />
      <Text style={type.smallStrong}>{course.rating.toFixed(1)}</Text>
      <Text style={type.small}>({course.reviewCount})</Text>
    </View>
  ) : (
    <Badge label="New course" tone="accent" />
  );

/** Vertical course card used in rails and grids */
export const CourseCard = React.memo(function CourseCard({ course, width, enrolled, progress }: { course: Course; width?: number; enrolled?: boolean; progress?: number }) {
  const off = discountPercent(course.price, course.originalPrice);
  return (
    <PressableScale
      onPress={() => router.push(enrolled ? `/learn/${course.id}` : `/course/${course.id}`)}
      accessibilityRole="button"
      accessibilityLabel={enrolled ? `${course.title}, ${progress ?? 0}% complete` : `${course.title}, ${formatPrice(course.price)}`}
      style={[styles.card, width ? { width } : { flex: 1 }]}
      outerStyle={width ? undefined : { flex: 1 }}
    >
      <View>
        <Thumb uri={course.thumbnail} style={styles.cardThumb} radius={radius.lg} />
        <LinearGradient colors={['transparent', 'rgba(11,18,32,0.35)']} style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} pointerEvents="none" />
        <View style={styles.cardBadges}>
          {enrolled ? <Badge label="Enrolled" tone="success" /> : course.bestseller ? <Badge label="Bestseller" tone="dark" /> : null}
          {!enrolled && off > 0 && <Badge label={`${off}% off`} tone="accent" />}
        </View>
      </View>
      <View style={{ padding: 12, paddingTop: 10, gap: 6, flex: 1 }}>
        <Text style={[type.eyebrow, { color: colors.secondary, fontSize: 10.5 }]} numberOfLines={1}>{course.category}</Text>
        <Text style={[type.h3, { fontSize: 15.5, lineHeight: 21 }]} numberOfLines={2}>{course.title}</Text>
        {!!course.instructor.name && <Text style={type.small} numberOfLines={1}>{course.instructor.name}</Text>}
        <View style={styles.meta}>
          <Ionicons name="time-outline" size={13} color={colors.muted} />
          <Text style={type.small}>{formatDuration(course.durationHours)}</Text>
          <Text style={type.small}>·</Text>
          <Ionicons name="play-circle-outline" size={13} color={colors.muted} />
          <Text style={type.small}>{course.totalLessons} lessons</Text>
        </View>
        <View style={{ flex: 1 }} />
        {enrolled ? (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[type.smallStrong, { color: colors.success }]}>{(progress ?? 0) >= 100 ? 'Completed' : (progress ?? 0) > 0 ? 'Continue' : 'Start learning'}</Text>
              <Text style={type.small}>{progress ?? 0}%</Text>
            </View>
            <ProgressBar percent={progress ?? 0} height={5} />
          </View>
        ) : (
          <>
            <PriceTag price={course.price} original={course.originalPrice} />
            <Rating course={course} />
          </>
        )}
      </View>
    </PressableScale>
  );
});

/** Horizontal compact row used in search results and lists */
export const CourseRow = React.memo(function CourseRow({ course, enrolled }: { course: Course; enrolled?: boolean }) {
  return (
  <Pressable
    onPress={() => router.push(`/course/${course.id}`)}
    accessibilityRole="button"
    accessibilityLabel={course.title}
    style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}
  >
    <Thumb uri={course.thumbnail} style={styles.rowThumb} radius={radius.md} />
    <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
      <Text style={[type.eyebrow, { color: colors.secondary, fontSize: 10.5 }]} numberOfLines={1}>{course.category} · {course.level}</Text>
      <Text style={[type.h3, { fontSize: 15.5, lineHeight: 21 }]} numberOfLines={2}>{course.title}</Text>
      {!!course.subtitle && <Text style={type.small} numberOfLines={1}>{course.subtitle}</Text>}
      <View style={styles.meta}>
        <Ionicons name="time-outline" size={13} color={colors.muted} />
        <Text style={type.small}>{formatDuration(course.durationHours)}</Text>
        <Text style={type.small}>· {course.totalLessons} lessons</Text>
      </View>
      {enrolled ? <Badge label="Enrolled" tone="success" /> : <PriceTag price={course.price} original={course.originalPrice} />}
    </View>
  </Pressable>
  );
});

/** My Learning card with progress */
export const LearningCard = React.memo(function LearningCard({ item, compact }: { item: LearningItem; compact?: boolean }) {
  const { course, progress } = item;
  return (
    <Pressable
      onPress={() => router.push(`/learn/${course.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${course.title}, ${progress.percent}% complete`}
      style={({ pressed }) => [styles.learn, compact && { width: 290 }, pressed && { opacity: 0.94 }]}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Thumb uri={course.thumbnail} style={styles.learnThumb} radius={radius.md} />
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <Text style={[type.h3, { fontSize: 15.5, lineHeight: 21 }]} numberOfLines={2}>{course.title}</Text>
          <Text style={type.small} numberOfLines={1}>{course.instructor.name}</Text>
        </View>
      </View>
      <View style={{ gap: 6, marginTop: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={type.smallStrong}>{item.completed ? 'Completed' : `${progress.percent}% complete`}</Text>
          <Text style={type.small}>{progress.completed}/{progress.total || course.totalLessons} lessons</Text>
        </View>
        <ProgressBar percent={item.completed ? 100 : progress.percent} />
      </View>
      {!compact && (
        <Button
          title={item.completed ? 'Review course' : progress.completed > 0 ? 'Continue learning' : 'Start learning'}
          icon="play"
          size="md"
          variant={item.completed ? 'secondary' : 'primary'}
          onPress={() => router.push(`/learn/${course.id}`)}
          style={{ marginTop: 14 }}
        />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 6, ...shadow },
  cardThumb: { width: '100%', aspectRatio: 16 / 10 },
  cardBadges: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  row: { flexDirection: 'row', gap: 14, backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 10 },
  rowThumb: { width: 112, height: 112 },
  learn: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 14, ...shadow },
  learnThumb: { width: 76, height: 76 },
});
