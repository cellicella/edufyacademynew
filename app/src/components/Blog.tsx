import React, { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, fonts, gradients, radius, shadow, type } from '@/theme';
import { BlogPost } from '@/services/blog';
import { Block, Inline, parseHtml } from '@/logic/html';
import { parseLink } from '@/logic/deepLinks';
import { openTarget } from '@/lib/navigation';
import { formatDate } from '@/utils/format';
import { PressableScale } from './Engagement';

/* ------------------------------------------------------------------ cards */
export const BlogCard: React.FC<{ post: BlogPost; width?: number }> = React.memo(({ post, width }) => (
  <PressableScale
    onPress={() => router.push(`/blog/${post.slug}`)}
    style={[styles.card, width ? { width } : null]}
    accessibilityRole="button"
    accessibilityLabel={`${post.title}. ${post.readingMinutes} minute read`}
  >
    <View style={styles.cover}>
      <LinearGradient colors={gradients.brand} style={StyleSheet.absoluteFill} />
      {post.coverImageUrl ? <Image source={{ uri: post.coverImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Ionicons name="newspaper-outline" size={30} color="rgba(255,255,255,0.85)" />}
    </View>
    <View style={{ padding: 14, gap: 6, flex: 1 }}>
      {!!post.category && <Text style={[type.eyebrow, { fontSize: 10.5 }]} numberOfLines={1}>{post.category}</Text>}
      <Text style={[type.h3, { fontSize: 16, lineHeight: 22 }]} numberOfLines={2}>{post.title}</Text>
      {!!post.excerpt && <Text style={type.small} numberOfLines={2}>{post.excerpt}</Text>}
      <View style={{ flex: 1 }} />
      <Text style={type.small}>{post.publishedAt ? formatDate(post.publishedAt) : ''} · {post.readingMinutes} min read</Text>
    </View>
  </PressableScale>
));

/* ------------------------------------------------------------------ article body */
const openLink = (href: string) => {
  const t = parseLink(href);
  if (t) openTarget(t);
  else if (/^mailto:/i.test(href)) Linking.openURL(href).catch(() => undefined);
};

const Inlines: React.FC<{ inlines: Inline[]; style: any }> = ({ inlines, style }) => (
  <Text style={style}>
    {inlines.map((i, k) => (
      <Text
        key={k}
        onPress={i.href ? () => openLink(i.href!) : undefined}
        accessibilityRole={i.href ? 'link' : undefined}
        style={[
          i.bold && { fontFamily: fonts.bodyBold },
          i.italic && { fontStyle: 'italic' },
          i.underline && { textDecorationLine: 'underline' },
          i.code && styles.code,
          i.href && styles.link,
        ]}
      >
        {i.text}
      </Text>
    ))}
  </Text>
);

const ArticleImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [ratio, setRatio] = useState(16 / 9);
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image
      source={{ uri: src }}
      style={{ width: '100%', aspectRatio: ratio, borderRadius: radius.lg, backgroundColor: colors.primarySoft }}
      contentFit="cover"
      transition={200}
      accessibilityLabel={alt || undefined}
      onLoad={(e) => e.source.width && e.source.height && setRatio(Math.max(0.5, Math.min(2.5, e.source.width / e.source.height)))}
      onError={() => setFailed(true)}
    />
  );
};

export const ArticleBody: React.FC<{ html: string }> = ({ html }) => {
  const blocks = useMemo(() => parseHtml(html), [html]);
  const { width } = useWindowDimensions();
  const big = width > 600;
  return (
    <View style={{ gap: 14 }}>
      {blocks.map((b: Block, i) => {
        switch (b.type) {
          case 'h2':
            return <Inlines key={i} inlines={b.inlines} style={[styles.h2, i > 0 && { marginTop: 10 }]} />;
          case 'h3':
            return <Inlines key={i} inlines={b.inlines} style={[styles.h3, i > 0 && { marginTop: 6 }]} />;
          case 'quote':
            return (
              <View key={i} style={styles.quote}>
                <Inlines inlines={b.inlines} style={[styles.p, { fontStyle: 'italic', color: colors.text }]} />
              </View>
            );
          case 'li':
            return (
              <View key={i} style={{ flexDirection: 'row', gap: 10, paddingLeft: 4 }}>
                <Text style={[styles.p, { color: colors.primary, fontFamily: fonts.bodyBold }]}>{b.ordered ? `${b.index}.` : '•'}</Text>
                <Inlines inlines={b.inlines} style={[styles.p, { flex: 1 }]} />
              </View>
            );
          case 'pre':
            return (
              <View key={i} style={styles.pre}>
                <Text style={styles.preText} selectable>{b.text}</Text>
              </View>
            );
          case 'img':
            return <ArticleImage key={i} src={b.src} alt={b.alt} />;
          case 'hr':
            return <View key={i} style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />;
          default:
            return <Inlines key={i} inlines={b.inlines} style={[styles.p, big && { fontSize: 17.5, lineHeight: 29 }]} />;
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow },
  cover: { aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  p: { fontFamily: fonts.body, fontSize: 16.5, lineHeight: 27, color: '#1f2937' },
  h2: { fontFamily: fonts.display, fontSize: 22, lineHeight: 29, color: colors.ink, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.displayBold, fontSize: 18.5, lineHeight: 25, color: colors.ink },
  link: { color: colors.primary, textDecorationLine: 'underline' },
  code: { fontFamily: 'monospace', backgroundColor: colors.hairline, fontSize: 14.5 },
  quote: { borderLeftWidth: 4, borderLeftColor: colors.secondary, backgroundColor: colors.bg, paddingVertical: 10, paddingHorizontal: 14, borderTopRightRadius: radius.md, borderBottomRightRadius: radius.md },
  pre: { backgroundColor: '#0B1220', borderRadius: radius.md, padding: 14 },
  preText: { fontFamily: 'monospace', fontSize: 13.5, lineHeight: 20, color: '#E2E8F0' },
});
