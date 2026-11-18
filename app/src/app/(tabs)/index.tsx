import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useBundles, useCategories, useCertificates, useCourses, useMyLearning } from '@/hooks/queries';
import { useBanners, useBlogPosts, useOffers, useRecentlyViewed, useUnreadCount } from '@/hooks/engagement';
import { BlogCard } from '@/components/Blog';
import { BundleCard } from '@/components/BundleCard';
import { CourseCard, LearningCard } from '@/components/CourseCards';
import { BannerCarousel, CountBadge, OfferCard, PressableScale, SlideItem, slideFromBanner } from '@/components/Engagement';
import { Avatar, Chip, ErrorState, FadeIn, ProgressBar, SectionHeader, Skeleton } from '@/components/ui';
import { colors, fonts, gradients, radius, shadow, type } from '@/theme';
import { discountPercent, firstName, formatPrice } from '@/utils/format';
import { Course } from '@/lib/types';
import { friendlyMessage } from '@/logic/apiErrors';
import { recommend } from '@/logic/engagement';
import { prefs } from '@/lib/secureStorage';
import { permissionStatus, pushSupport, registerForPush } from '@/services/push';
import { useSiteSettings } from '@/hooks/useSiteSettings';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { profile, session } = useAuth();
  const courses = useCourses();
  const categories = useCategories();
  const learning = useMyLearning();
  const bundles = useBundles();
  const banners = useBanners();
  const offers = useOffers();
  const certificates = useCertificates();
  const unread = useUnreadCount();
  const recent = useRecentlyViewed();
  const blog = useBlogPosts();
  const site = useSiteSettings(); // Admin → Settings → App Configuration (which Home sections to show)
  const { width } = useWindowDimensions();
  const bannerW = Math.min(width - 40, 640);
  const scrollY = useRef(new Animated.Value(0)).current;

  const enrolledIds = useMemo(() => new Set(learning.items.map((i) => i.course.id)), [learning.items]);
  const progressById = useMemo(() => new Map(learning.items.map((i) => [i.course.id, i.completed ? 100 : i.progress.percent])), [learning.items]);
  const all = courses.data || [];
  const byId = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);

  // Admin-managed banners first; until any exist, featured / best-value courses fill the slider
  const slides = useMemo<SlideItem[]>(() => {
    if (banners.data.length) return banners.data.map(slideFromBanner);
    const pick = [...all.filter((c) => c.featured), ...[...all].sort((a, b) => discountPercent(b.price, b.originalPrice) - discountPercent(a.price, a.originalPrice))];
    return [...new Map(pick.map((c) => [c.id, c])).values()]
      .filter((c) => !enrolledIds.has(c.id))
      .slice(0, 4)
      .map((c) => {
        const off = discountPercent(c.price, c.originalPrice);
        return {
          key: `c-${c.id}`, title: c.title, subtitle: `${formatPrice(c.price)} · ${c.totalLessons} lessons`, imageUrl: c.thumbnail,
          pill: off > 0 ? `Save ${off}%` : c.featured ? 'Featured' : c.category, cta: 'View course', onPress: () => router.push(`/course/${c.id}`),
        };
      });
  }, [banners.data, all, enrolledIds]);

  const featured = useMemo(() => {
    const f = all.filter((c) => c.featured || c.bestseller);
    return (f.length >= 3 ? f : all).slice(0, 8);
  }, [all]);
  const popular = useMemo(() => [...all].sort((a, b) => b.enrolledCount - a.enrolledCount || b.rating - a.rating).slice(0, 8), [all]);
  const trending = useMemo(() => all.filter((c) => c.trending).slice(0, 8), [all]);
  const latest = useMemo(() => [...all].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 8), [all]);
  const recommended = useMemo(() => recommend<Course>(all, enrolledIds, recent.ids, 8), [all, enrolledIds, recent.ids]);
  const recentCourses = useMemo(() => recent.ids.map((id) => byId.get(id)).filter(Boolean).slice(0, 8) as Course[], [recent.ids, byId]);

  const overall = useMemo(() => {
    if (!learning.items.length) return 0;
    return Math.round(learning.items.reduce((n, i) => n + (i.completed ? 100 : i.progress.percent), 0) / learning.items.length);
  }, [learning.items]);
  const lessonsDone = useMemo(() => learning.items.reduce((n, i) => n + i.progress.completed, 0), [learning.items]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([courses.refetch(), learning.refetch(), bundles.refetch(), banners.refetch(), offers.refetch(), unread.refetch(), certificates.refetch(), blog.refetch()]);
    setRefreshing(false);
  };

  // Gentle opt-in for push notifications (shown until answered or dismissed)
  const [askPush, setAskPush] = useState(false);
  useEffect(() => {
    if (!session || pushSupport()) return;
    Promise.all([permissionStatus(), prefs.get('push_primer_dismissed')]).then(([p, dismissed]) => setAskPush(p === 'undetermined' && dismissed !== '1'));
  }, [session]);
  const enablePush = async () => {
    setAskPush(false);
    await registerForPush(true);
  };
  const dismissPush = () => {
    setAskPush(false);
    prefs.set('push_primer_dismissed', '1').catch(() => undefined);
  };

  const rail = (list: Course[]) => (
    <FlatList
      horizontal
      data={list}
      keyExtractor={(c) => c.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 6 }}
      initialNumToRender={3}
      windowSize={5}
      renderItem={({ item }) => <CourseCard course={item} width={236} enrolled={enrolledIds.has(item.id)} progress={progressById.get(item.id)} />}
    />
  );
  const section = (title: string, eyebrow: string | undefined, action: string | undefined, onAction: (() => void) | undefined, body: React.ReactNode, delay = 0) => (
    <FadeIn delay={delay} style={styles.block}>
      <View style={{ paddingHorizontal: 20 }}>
        <SectionHeader eyebrow={eyebrow} title={title} action={action} onAction={onAction} />
      </View>
      {body}
    </FadeIn>
  );

  // Header gains a hairline + shadow once content scrolls under it
  const headerShade = scrollY.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.headerShade, { opacity: headerShade }]} />
        <Pressable onPress={() => router.push('/(tabs)/profile')} accessibilityLabel="Your profile" accessibilityRole="button">
          <View style={styles.avatarRing}>
            <Avatar uri={profile?.avatarUrl} name={profile?.fullName} size={42} />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={type.small}>{greeting()},</Text>
          <Text style={[type.h2, { marginTop: 1 }]} numberOfLines={1}>{firstName(profile?.fullName)} 👋</Text>
        </View>
        <PressableScale onPress={() => router.push('/notifications')} style={styles.iconBtn} accessibilityLabel={`Notifications${unread.data ? `, ${unread.data} unread` : ''}`} accessibilityRole="button">
          <Ionicons name={unread.data ? 'notifications' : 'notifications-outline'} size={22} color={colors.ink} />
          <CountBadge count={unread.data || 0} />
        </PressableScale>
      </View>

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 36 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {/* Search */}
        <PressableScale scaleTo={0.985} onPress={() => router.push({ pathname: '/(tabs)/explore', params: { focus: '1' } })} style={styles.search} accessibilityRole="search" accessibilityLabel="Search courses">
          <Ionicons name="search" size={19} color={colors.muted} />
          <Text style={[type.body, { color: colors.subtle, flex: 1 }]}>What do you want to learn today?</Text>
          <LinearGradient colors={gradients.brand} style={styles.searchBtn}>
            <Ionicons name="options-outline" size={18} color={colors.white} />
          </LinearGradient>
        </PressableScale>

        {askPush && (
          <FadeIn style={styles.primer}>
            <View style={styles.primerIcon}><Ionicons name="notifications" size={20} color={colors.white} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.bodyStrong}>Never miss a new course</Text>
              <Text style={type.small}>Get notified about new courses, offers and your certificates.</Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
                <Pressable onPress={enablePush} accessibilityRole="button"><Text style={[type.smallStrong, { color: colors.primary }]}>Turn on</Text></Pressable>
                <Pressable onPress={dismissPush} accessibilityRole="button"><Text style={[type.smallStrong, { color: colors.muted }]}>Not now</Text></Pressable>
              </View>
            </View>
          </FadeIn>
        )}

        {courses.error && !courses.data ? (
          <ErrorState message={friendlyMessage(courses.error)} onRetry={() => courses.refetch()} />
        ) : courses.isLoading ? (
          <View style={{ paddingHorizontal: 20, gap: 16, marginTop: 20 }}>
            <Skeleton style={{ height: 196, borderRadius: radius.xl }} />
            <Skeleton style={{ height: 110, borderRadius: radius.xl }} />
            <Skeleton style={{ height: 24, width: 180 }} />
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Skeleton style={{ height: 250, flex: 1, borderRadius: radius.xl }} />
              <Skeleton style={{ height: 250, flex: 1, borderRadius: radius.xl }} />
            </View>
          </View>
        ) : (
          <>
            {site.app.noticeEnabled && !!site.app.noticeText.trim() && (
              <View style={styles.notice} accessibilityRole="text">
                <Ionicons name="megaphone-outline" size={18} color={colors.primary} />
                <Text style={styles.noticeText}>{site.app.noticeText}</Text>
              </View>
            )}

            {slides.length > 0 && (
              <FadeIn style={{ marginTop: 20 }}>
                <BannerCarousel items={slides} width={bannerW} />
              </FadeIn>
            )}

            {/* Learning progress overview */}
            {learning.items.length > 0 && (
              <FadeIn delay={80}>
                <PressableScale scaleTo={0.985} onPress={() => router.push('/dashboard')} style={styles.overview} accessibilityRole="button" accessibilityLabel={`Your learning: ${overall}% overall progress`}>
                  <LinearGradient colors={gradients.brandDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <View style={[styles.orb, { right: -30, top: -40 }]} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.overviewEyebrow}>Your learning</Text>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                    <Text style={styles.overviewBig}>{overall}%</Text>
                    <Text style={[styles.overviewSmall, { marginBottom: 6 }]}>overall progress</Text>
                  </View>
                  <ProgressBar percent={overall} height={7} track="rgba(255,255,255,0.25)" />
                  <View style={styles.statsRow}>
                    <Stat value={learning.items.length} label="Enrolled" />
                    <Stat value={learning.completed.length} label="Completed" />
                    <Stat value={lessonsDone} label="Lessons done" />
                    <Stat value={certificates.data?.length ?? 0} label="Certificates" />
                  </View>
                </PressableScale>
              </FadeIn>
            )}

            {learning.inProgress.length > 0 &&
              section('Continue learning', 'Pick up where you left off', 'My Learning', () => router.push('/(tabs)/learning'), (
                <FlatList
                  horizontal
                  data={learning.inProgress.slice(0, 6)}
                  keyExtractor={(i) => i.course.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 6 }}
                  renderItem={({ item }) => <LearningCard item={item} compact />}
                />
              ), 120)}

            {site.app.showFeaturedCourses && featured.length > 0 && section('Featured courses', 'Editor’s selection', 'See all', () => router.push('/(tabs)/explore'), rail(featured), 140)}

            {site.app.showOffers && offers.data.length > 0 &&
              section('Special offers', 'Limited time', 'See all', () => router.push('/offers'), (
                <FlatList
                  horizontal
                  data={offers.data}
                  keyExtractor={(o) => o.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 6 }}
                  renderItem={({ item }) => <OfferCard offer={item} width={250} onPress={() => router.push(`/offer/${item.id}`)} />}
                />
              ))}

            {site.app.showBundles && (bundles.data?.length || 0) > 0 &&
              section('Course bundles', 'Save more', 'See all', () => router.push('/bundles'), (
                <FlatList
                  horizontal
                  data={bundles.data}
                  keyExtractor={(b) => b.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 6 }}
                  renderItem={({ item }) => <BundleCard bundle={item} width={290} ownedCount={item.courses.filter((c) => enrolledIds.has(c.id)).length} />}
                />
              ))}

            {popular.length > 0 && section('Popular courses', 'Learners love these', 'See all', () => router.push({ pathname: '/(tabs)/explore', params: { sort: 'popular' } }), rail(popular))}
            {trending.length >= 2 && section('Trending now', 'What’s hot', undefined, undefined, rail(trending))}
            {recommended.length > 0 && section('Recommended for you', recent.ids.length || enrolledIds.size ? 'Based on your learning' : 'Top picks', undefined, undefined, rail(recommended))}
            {latest.length > 0 && section('New courses', 'Fresh on the timetable', 'See all', () => router.push({ pathname: '/(tabs)/explore', params: { sort: 'newest' } }), rail(latest))}
            {recentCourses.length > 0 && section('Recently viewed', undefined, undefined, undefined, rail(recentCourses))}

            {site.app.showBlog && (blog.data?.length || 0) > 0 &&
              section('From the blog', 'Tips & news', 'See all', () => router.push('/blog'), (
                <FlatList
                  horizontal
                  data={blog.data!.slice(0, 6)}
                  keyExtractor={(p) => p.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 6 }}
                  renderItem={({ item }) => <BlogCard post={item} width={260} />}
                />
              ))}

            {categories.data.length > 0 &&
              section('Browse categories', undefined, 'See all', () => router.push('/(tabs)/explore'), (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                  {categories.data.map((c) => (
                    <Chip key={c.slug} label={c.name} count={c.count} onPress={() => router.push({ pathname: '/(tabs)/explore', params: { category: c.slug } })} />
                  ))}
                </ScrollView>
              ))}
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

const Stat: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <View style={{ flex: 1 }}>
    <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.white }}>{value}</Text>
    <Text style={styles.overviewSmall} numberOfLines={1}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 20, marginTop: 16, padding: 14, borderRadius: radius.lg, backgroundColor: colors.primarySoft },
  noticeText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.ink },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12, backgroundColor: colors.bg, zIndex: 2 },
  headerShade: { backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border, ...shadow },
  avatarRing: { padding: 2, borderRadius: 26, borderWidth: 2, borderColor: colors.primarySoft },
  iconBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  search: {
    marginHorizontal: 20, marginTop: 8, height: 56, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 18, paddingRight: 6, ...shadow,
  },
  searchBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  primer: { marginHorizontal: 20, marginTop: 16, padding: 14, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: '#C9D6FF', flexDirection: 'row', gap: 12 },
  primerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' },
  overview: { marginHorizontal: 20, marginTop: 24, padding: 18, gap: 10, borderRadius: radius.xl, overflow: 'hidden', ...shadow },
  orb: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)' },
  overviewEyebrow: { fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 1.1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' },
  overviewBig: { fontFamily: fonts.display, fontSize: 38, lineHeight: 44, color: colors.white, letterSpacing: -1 },
  overviewSmall: { fontFamily: fonts.bodyMedium, fontSize: 12.5, color: 'rgba(255,255,255,0.8)' },
  statsRow: { flexDirection: 'row', marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)' },
  block: { marginTop: 30 },
});
