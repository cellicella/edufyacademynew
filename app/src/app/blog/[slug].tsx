import React, { useMemo } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBlogPost, useBlogPosts } from '@/hooks/engagement';
import { ScreenHeader } from '@/components/Chrome';
import { ArticleBody, BlogCard } from '@/components/Blog';
import { Avatar, EmptyState, ErrorState, FadeIn, Loading } from '@/components/ui';
import { colors, fonts, radius, type } from '@/theme';
import { formatDate } from '@/utils/format';
import { friendlyMessage } from '@/logic/apiErrors';
import { config } from '@/lib/config';
import { cdnImage } from '@/logic/cdnImage';

export default function BlogPostScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const q = useBlogPost(slug);
  const all = useBlogPosts();
  const post = q.data;

  const related = useMemo(() => {
    if (!post) return [];
    const score = (p: typeof post) => (p.category && p.category === post.category ? 10 : 0) + p.tags.filter((t) => post.tags.includes(t)).length;
    return (all.data || []).filter((p) => p.id !== post.id).sort((a, b) => score(b) - score(a)).slice(0, 3);
  }, [post, all.data]);

  const share = () => {
    if (!post) return;
    const url = config.webUrl ? `${config.webUrl}/blog/${post.slug}` : '';
    Share.share({ title: post.title, message: url ? `${post.title}\n${url}` : post.title, ...(url ? { url } : {}) }).catch(() => undefined);
  };

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: colors.bg }}><ScreenHeader title="Article" /><Loading /></View>;
  if (q.error && !q.data) return <View style={{ flex: 1, backgroundColor: colors.bg }}><ScreenHeader title="Article" /><ErrorState message={friendlyMessage(q.error)} onRetry={() => q.refetch()} /></View>;
  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Article" />
        <EmptyState icon="newspaper-outline" title="Article not found" body="It may have been moved or unpublished." action="Back to the blog" onAction={() => router.replace('/blog')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title=""
        right={
          <Pressable onPress={share} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share article" style={styles.share}>
            <Ionicons name="share-social-outline" size={20} color={colors.ink} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <FadeIn style={{ paddingHorizontal: 20, gap: 10 }}>
          {!!post.category && <Text style={type.eyebrow}>{post.category}</Text>}
          <Text style={styles.title} accessibilityRole="header">{post.title}</Text>
          {!!post.excerpt && <Text style={[type.body, { fontSize: 16.5, color: colors.muted }]}>{post.excerpt}</Text>}
          <View style={styles.author}>
            <Avatar uri={post.authorAvatarUrl} name={post.authorName} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={type.bodyStrong}>{post.authorName}</Text>
              <Text style={type.small}>{post.publishedAt ? formatDate(post.publishedAt) : ''} · {post.readingMinutes} min read</Text>
            </View>
          </View>
        </FadeIn>
        {post.coverImageUrl && <Image source={{ uri: cdnImage(post.coverImageUrl, 1080) }} style={styles.cover} contentFit="cover" transition={250} />}
        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <ArticleBody html={post.contentHtml} />
          {post.tags.length > 0 && (
            <View style={styles.tags}>
              {post.tags.map((t) => <Text key={t} style={styles.tag}>#{t}</Text>)}
            </View>
          )}
          <Pressable onPress={share} style={styles.shareRow} accessibilityRole="button">
            <Ionicons name="share-social" size={18} color={colors.primary} />
            <Text style={[type.bodyStrong, { color: colors.primary }]}>Share this article</Text>
          </Pressable>
        </View>
        {related.length > 0 && (
          <View style={{ marginTop: 28, gap: 14 }}>
            <Text style={[type.h2, { paddingHorizontal: 20 }]}>Related articles</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 6 }}>
              {related.map((p) => <BlogCard key={p.id} post={p} width={260} />)}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.display, fontSize: 27, lineHeight: 34, color: colors.ink, letterSpacing: -0.5 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, marginTop: 6 },
  cover: { marginHorizontal: 20, marginTop: 18, aspectRatio: 16 / 9, borderRadius: radius.xl, backgroundColor: colors.primarySoft },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24 },
  tag: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, overflow: 'hidden' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 20, paddingVertical: 10 },
  share: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
