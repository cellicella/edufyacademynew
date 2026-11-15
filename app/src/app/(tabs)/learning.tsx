import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LearningItem, useBundles, useCertificates, useMyLearning } from '@/hooks/queries';
import { LearningCard, Thumb } from '@/components/CourseCards';
import { Chip, EmptyState, ErrorState, ProgressBar, Skeleton } from '@/components/ui';
import { colors, radius, shadow, type } from '@/theme';
import { friendlyMessage } from '@/logic/apiErrors';

type Tab = 'progress' | 'completed' | 'bundles';

interface OwnedBundle {
  id: string;
  title: string;
  thumbnail: string | null;
  items: LearningItem[];
}

export default function MyLearning() {
  const { items, inProgress, completed, isLoading, error, refetch } = useMyLearning();
  const bundles = useBundles();
  const certificates = useCertificates();
  const [tab, setTab] = useState<Tab>('progress');
  const [refreshing, setRefreshing] = useState(false);

  const certByCourse = useMemo(() => new Map((certificates.data || []).map((c) => [c.courseId, c])), [certificates.data]);

  // Bundles the student bought: courses whose enrollment came from a bundle purchase
  const ownedBundles = useMemo<OwnedBundle[]>(() => {
    const groups = new Map<string, LearningItem[]>();
    for (const it of items) if (it.bundleId) groups.set(it.bundleId, [...(groups.get(it.bundleId) || []), it]);
    return [...groups.entries()].map(([id, its]) => {
      const b = bundles.data?.find((x) => x.id === id);
      return { id, title: b?.title || 'Course bundle', thumbnail: b?.thumbnail || its[0]?.course.thumbnail || null, items: its };
    });
  }, [items, bundles.data]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), bundles.refetch(), certificates.refetch()]);
    setRefreshing(false);
  };

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 14 }}>
        <Text style={type.h1}>My Learning</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="In progress" count={inProgress.length} active={tab === 'progress'} onPress={() => setTab('progress')} />
          <Chip label="Completed" count={completed.length} active={tab === 'completed'} onPress={() => setTab('completed')} />
          {ownedBundles.length > 0 && <Chip label="Bundles" count={ownedBundles.length} active={tab === 'bundles'} onPress={() => setTab('bundles')} />}
        </ScrollView>
      </View>
      {error ? (
        <ErrorState message={friendlyMessage(error)} onRetry={refetch} />
      ) : isLoading ? (
        <View style={{ padding: 20, gap: 14 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 190, borderRadius: radius.xl }} />)}
        </View>
      ) : tab === 'bundles' ? (
        <FlatList
          data={ownedBundles}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }}
          refreshControl={refresh}
          renderItem={({ item: b }) => <OwnedBundleCard bundle={b} />}
          ListEmptyComponent={<EmptyState icon="albums-outline" title="No bundles yet" body="Bundles you buy will appear here with all their courses." action="Browse bundles" onAction={() => router.push('/bundles')} />}
        />
      ) : (
        <FlatList
          data={tab === 'progress' ? inProgress : completed}
          keyExtractor={(i) => i.course.id}
          contentContainerStyle={{ padding: 20, gap: 14, flexGrow: 1 }}
          renderItem={({ item }) => (
            <View>
              <LearningCard item={item} />
              {item.completed && (
                <Pressable
                  onPress={() => {
                    const cert = certByCourse.get(item.course.id);
                    if (cert) router.push(`/certificate/${cert.id}`);
                    else router.push({ pathname: '/certificates', params: { claim: item.course.id } });
                  }}
                  style={styles.certLink}
                  accessibilityRole="button"
                >
                  <Ionicons name="ribbon" size={18} color={colors.accent} />
                  <Text style={[type.smallStrong, { color: colors.accent, flex: 1 }]}>
                    {certByCourse.has(item.course.id) ? 'View your certificate' : 'Get your certificate'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.accent} />
                </Pressable>
              )}
            </View>
          )}
          refreshControl={refresh}
          ListEmptyComponent={
            items.length === 0 ? (
              <EmptyState icon="library-outline" title="No courses yet" body="Courses you buy or enroll in will appear here." action="Explore courses" onAction={() => router.push('/(tabs)/explore')} />
            ) : tab === 'progress' ? (
              <EmptyState icon="trophy-outline" title="All caught up!" body="You’ve completed every course you’re enrolled in." action="Find a new course" onAction={() => router.push('/(tabs)/explore')} />
            ) : (
              <EmptyState icon="ribbon-outline" title="No completed courses yet" body="Finish all lessons in a course to see it here." />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const OwnedBundleCard: React.FC<{ bundle: OwnedBundle }> = ({ bundle }) => {
  const done = bundle.items.filter((i) => i.completed).length;
  const percent = Math.round(bundle.items.reduce((n, i) => n + (i.completed ? 100 : i.progress.percent), 0) / Math.max(1, bundle.items.length));
  return (
    <View style={styles.bundle}>
      <Pressable onPress={() => router.push(`/bundle/${bundle.id}`)} style={{ flexDirection: 'row', gap: 12 }} accessibilityRole="button">
        <Thumb uri={bundle.thumbnail} style={{ width: 64, height: 64 }} radius={radius.md} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={type.eyebrow}>Bundle</Text>
          <Text style={[type.h3, { fontSize: 16 }]} numberOfLines={2}>{bundle.title}</Text>
          <Text style={type.small}>{bundle.items.length} courses · {done} completed</Text>
        </View>
      </Pressable>
      <View style={{ marginTop: 12, gap: 6 }}>
        <ProgressBar percent={percent} />
        <Text style={type.small}>{percent}% of the bundle complete</Text>
      </View>
      <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.hairline }}>
        {bundle.items.map((i) => (
          <Pressable key={i.course.id} onPress={() => router.push(`/learn/${i.course.id}`)} style={styles.bundleRow} accessibilityRole="button" accessibilityLabel={`Open ${i.course.title}`}>
            <Ionicons name={i.completed ? 'checkmark-circle' : 'play-circle-outline'} size={20} color={i.completed ? colors.success : colors.primary} />
            <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{i.course.title}</Text>
            <Text style={type.small}>{i.completed ? 'Done' : `${i.progress.percent}%`}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  certLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -6, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, backgroundColor: colors.accentSoft },
  bundle: { padding: 14, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, ...shadow },
  bundleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
});
