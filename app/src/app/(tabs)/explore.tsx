import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useBundles, useCategories, useCourses, useEnrollments } from '@/hooks/queries';
import { BundleCard } from '@/components/BundleCard';
import { router } from 'expo-router';
import { CourseRow } from '@/components/CourseCards';
import { Chip, EmptyState, ErrorState, SearchBar, Skeleton } from '@/components/ui';
import { colors, radius, type } from '@/theme';
import { discountPercent } from '@/utils/format';
import { friendlyMessage } from '@/logic/apiErrors';

type Sort = 'relevance' | 'popular' | 'newest' | 'rating' | 'price-low' | 'price-high';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'relevance', label: 'Recommended' },
  { id: 'popular', label: 'Most popular' },
  { id: 'newest', label: 'Newest' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'price-low', label: 'Price: low → high' },
  { id: 'price-high', label: 'Price: high → low' },
];
type PriceFilter = 'all' | 'free' | 'paid' | 'discounted';

export default function Explore() {
  const params = useLocalSearchParams<{ category?: string; sort?: string; focus?: string; q?: string }>();
  const courses = useCourses();
  const categories = useCategories();
  const enrollments = useEnrollments();
  const bundles = useBundles();
  const enrolled = useMemo(() => new Set((enrollments.data || []).map((e) => e.courseId)), [enrollments.data]);

  const [q, setQ] = useState(params.q || '');
  const [category, setCategory] = useState(params.category || 'all');
  const [level, setLevel] = useState('all');
  const [price, setPrice] = useState<PriceFilter>('all');
  const [sort, setSort] = useState<Sort>((params.sort as Sort) || 'relevance');

  // Respond to navigation from Home (category chip / "See all")
  useEffect(() => {
    if (params.category) setCategory(params.category);
  }, [params.category]);
  useEffect(() => {
    if (params.sort) setSort(params.sort as Sort);
  }, [params.sort]);

  const levels = useMemo(() => ['all', ...new Set((courses.data || []).map((c) => c.level).filter(Boolean))], [courses.data]);

  // Typing stays smooth: the list is filtered with a deferred copy of the search text
  const deferredQ = useDeferredValue(q);
  const results = useMemo(() => {
    const term = deferredQ.trim().toLowerCase();
    let list = (courses.data || []).filter((c) => {
      if (category !== 'all' && c.categorySlug !== category) return false;
      if (level !== 'all' && c.level !== level) return false;
      if (price === 'free' && c.price > 0) return false;
      if (price === 'paid' && c.price <= 0) return false;
      if (price === 'discounted' && discountPercent(c.price, c.originalPrice) === 0) return false;
      if (!term) return true;
      return [c.title, c.subtitle, c.category, c.instructor.name, c.description].some((f) => (f || '').toLowerCase().includes(term));
    });
    list = [...list];
    if (sort === 'popular') list.sort((a, b) => b.enrolledCount - a.enrolledCount);
    else if (sort === 'newest') list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    else if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    else if (sort === 'price-low') list.sort((a, b) => a.price - b.price);
    else if (sort === 'price-high') list.sort((a, b) => b.price - a.price);
    else if (term) list.sort((a, b) => Number(b.title.toLowerCase().includes(term)) - Number(a.title.toLowerCase().includes(term)));
    return list;
  }, [courses.data, deferredQ, category, level, price, sort]);

  const filtersActive = category !== 'all' || level !== 'all' || price !== 'all' || sort !== 'relevance' || !!q;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 14 }}>
        <Text style={type.h1}>Explore courses</Text>
        <SearchBar value={q} onChangeText={setQ} autoFocus={params.focus === '1'} placeholder="Search by topic, course or instructor" />
      </View>

      <View style={{ marginTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All" active={category === 'all'} onPress={() => setCategory('all')} count={courses.data?.length} />
          {categories.data.map((c) => (
            <Chip key={c.slug} label={c.name} count={c.count} active={category === c.slug} onPress={() => setCategory(c.slug)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 8 }]}>
          {levels.map((l) => (
            <Chip key={l} label={l === 'all' ? 'Any level' : l} active={level === l} onPress={() => setLevel(l)} />
          ))}
          <View style={styles.divider} />
          {(['all', 'free', 'paid', 'discounted'] as PriceFilter[]).map((p) => (
            <Chip key={p} label={p === 'all' ? 'Any price' : p === 'discounted' ? 'On sale' : p[0].toUpperCase() + p.slice(1)} active={price === p} onPress={() => setPrice(p)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 8 }]}>
          {SORTS.map((s) => (
            <Chip key={s.id} label={s.label} active={sort === s.id} onPress={() => setSort(s.id)} />
          ))}
        </ScrollView>
      </View>

      {courses.error && !courses.data ? (
        <ErrorState message={friendlyMessage(courses.error)} onRetry={() => courses.refetch()} />
      ) : courses.isLoading ? (
        <View style={{ padding: 20, gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 132, borderRadius: radius.xl }} />)}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 20, paddingTop: 14, gap: 12, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          ListHeaderComponent={
            <View style={{ gap: 14 }}>
            {!filtersActive && (bundles.data?.length || 0) > 0 && (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={type.h3}>Course bundles</Text>
                  <Text style={[type.smallStrong, { color: colors.primary }]} onPress={() => router.push('/bundles')} accessibilityRole="button">See all</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {bundles.data!.map((b) => (
                    <BundleCard key={b.id} bundle={b} width={270} ownedCount={b.courses.filter((c) => enrolled.has(c.id)).length} />
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={type.small}>{results.length} course{results.length === 1 ? '' : 's'}</Text>
              {filtersActive && (
                <Text
                  style={[type.smallStrong, { color: colors.primary }]}
                  onPress={() => { setQ(''); setCategory('all'); setLevel('all'); setPrice('all'); setSort('relevance'); }}
                  accessibilityRole="button"
                >
                  Clear filters
                </Text>
              )}
            </View>
            </View>
          }
          renderItem={({ item }) => <CourseRow course={item} enrolled={enrolled.has(item.id)} />}
          ListEmptyComponent={<EmptyState icon="search-outline" title="No courses found" body="Try a different search or clear the filters." />}
          refreshControl={<RefreshControl refreshing={courses.isRefetching} onRefresh={() => { courses.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  divider: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: 4 },
});
