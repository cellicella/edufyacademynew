import React, { useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { prefs } from '@/lib/secureStorage';
import { Button } from '@/components/ui';
import { Logo } from '@/components/Chrome';
import { colors, gradients, radius, type } from '@/theme';

const SLIDES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'rocket-outline', title: 'Skills that move your career forward', body: 'Practical, project-based courses in technology and modern work — taught by practitioners.' },
  { icon: 'play-circle-outline', title: 'Learn anywhere, pick up where you left off', body: 'Stream lessons on your phone. Your progress syncs with your Edufy account on the web.' },
  { icon: 'ribbon-outline', title: 'Earn certificates anyone can verify', body: 'Finish a course to earn a certificate with a public verification code.' },
];

export default function Onboarding() {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList>(null);

  const finish = async (to: '/(auth)/login' | '/(auth)/register') => {
    await prefs.set('onboarding_done', '1').catch(() => undefined);
    router.replace(to);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.top}>
        <Logo size={36} subtitle={false} />
        <Text onPress={() => finish('/(auth)/login')} style={[type.smallStrong, { color: colors.primary }]} accessibilityRole="button">Skip</Text>
      </View>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: 28, justifyContent: 'center', flex: 1 }}>
            <LinearGradient colors={gradients.brandDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.art, { height: Math.min(300, height * 0.34) }]}>
              <View style={styles.ring} />
              <Ionicons name={item.icon} size={96} color={colors.white} />
            </LinearGradient>
            <Text style={[type.hero, { marginTop: 36 }]}>{item.title}</Text>
            <Text style={[type.body, { marginTop: 12, fontSize: 16.5, lineHeight: 26, color: colors.muted }]}>{item.body}</Text>
          </View>
        )}
      />
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && { width: 26, backgroundColor: colors.primary }]} />
          ))}
        </View>
        {index < SLIDES.length - 1 ? (
          <Button title="Next" icon="arrow-forward" onPress={() => list.current?.scrollToIndex({ index: index + 1 })} />
        ) : (
          <View style={{ gap: 10 }}>
            <Button title="Create free account" onPress={() => finish('/(auth)/register')} />
            <Button title="I already have an account" variant="ghost" onPress={() => finish('/(auth)/login')} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8 },
  art: { height: 300, borderRadius: radius.xxl, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: { position: 'absolute', width: 380, height: 380, borderRadius: 190, borderWidth: 40, borderColor: 'rgba(255,255,255,0.07)', top: -120, right: -140 },
  bottom: { paddingHorizontal: 24, paddingBottom: 16, gap: 18 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
});
