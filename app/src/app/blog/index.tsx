import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBlogPosts } from '@/hooks/engagement';
import { ScreenHeader } from '@/components/Chrome';
import { BlogCard } from '@/components/Blog';
import { SlideUp } from '@/components/Engagement';
import { Chip, EmptyState, ErrorState, SearchBar, Skeleton } from '@/components/ui';
import { colors, radius } from '@/theme';
import { friendlyMessage } from '@/logic/apiErrors';

export default function BlogScreen() {
  const insets = useSafeAreaInsets();
  const posts = useBlogPosts();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const all = posts.data || [];
  const categories = useMemo(() => [...new Set(all.map((p) => p.category).filter(Boolean) as string[])].sort(), [all]);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = all.filter((p) => (!category || p.category === category) && (!term || `${p.title} ${p.excerpt} ${p.tags.join(' ')}`.toLowerCase().includes(term)));
    // Featured posts first when no filter is applied
    return term || category ? filtered : [...filtered.filter((p) => p.isFeatured), ...filtered.filter((p) => !p.isFeatured)];
  }, [all, q, category]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Blog" />
      <View style={{ paddingHorizontal: 20, gap: 12, paddingBottom: 8 }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search articles" />
        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Chip label="All" active={!category} onPress={() => setCategory(null)} />
            {categories.map((c) => <Chip key={c} label={c} active={category === c} onPress={() => setCategory(category === c ? null : c)} />)}
          </ScrollView>
        )}
      </View>
      {posts.error ? (
        <ErrorState message={friendlyMessage(posts.error)} onRetry={() => posts.refetch()} />
      ) : posts.isLoading ? (
        <View style={{ padding: 20, gap: 16 }}>{[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 280, borderRadius: radius.xl }} />)}</View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={posts.isRefetching} onRefresh={async () => { await posts.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item, index }) => (
            <SlideUp index={index}>
              <BlogCard post={item} />
            </SlideUp>
          )}
          ListEmptyComponent={
            q || category ? (
              <EmptyState icon="search-outline" title="No articles match" body="Try a different search or category." />
            ) : (
              <EmptyState icon="newspaper-outline" title="Articles are coming soon" body="Guides, study tips and news from Edufy Academy will appear here." />
            )
          }
        />
      )}
    </View>
  );
}
