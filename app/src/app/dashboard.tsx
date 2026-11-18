import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useCertificates, useMyLearning, usePayments } from '@/hooks/queries';
import { ScreenHeader } from '@/components/Chrome';
import { LearningCard, Thumb } from '@/components/CourseCards';
import { Avatar, Button, Card, EmptyState, ErrorState, Loading, ProgressBar, SectionHeader } from '@/components/ui';
import { colors, fonts, gradients, radius, type } from '@/theme';
import { formatDate, formatPrice, timeAgo } from '@/utils/format';
import { friendlyMessage } from '@/logic/apiErrors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const learning = useMyLearning();
  const payments = usePayments();
  const certs = useCertificates();

  const totalLessons = learning.items.reduce((n, i) => n + (i.progress.total || 0), 0);
  const doneLessons = learning.items.reduce((n, i) => n + i.progress.completed, 0);
  const overall = totalLessons ? Math.round((doneLessons / totalLessons) * 100) : 0;
  const captured = (payments.data || []).filter((p) => p.status === 'captured');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Student dashboard" />
      {learning.error && !learning.items.length ? (
        <ErrorState message={friendlyMessage(learning.error)} onRetry={learning.refetch} />
      ) : learning.isLoading ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: insets.bottom + 40 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => { learning.refetch(); payments.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          <LinearGradient colors={gradients.brandDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar uri={profile?.avatarUrl} name={profile?.fullName} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 20, color: colors.white }} numberOfLines={1}>{profile?.fullName}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.75)' }} numberOfLines={1}>{profile?.email}</Text>
              </View>
            </View>
            <View style={{ marginTop: 20, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.heroLabel}>Overall progress</Text>
                <Text style={styles.heroValue}>{overall}%</Text>
              </View>
              <ProgressBar percent={overall} height={8} track="rgba(255,255,255,0.2)" />
              <Text style={styles.heroLabel}>{doneLessons} of {totalLessons} lessons completed across all courses</Text>
            </View>
          </LinearGradient>

          <View style={styles.grid}>
            <StatTile icon="library" label="Enrolled" value={learning.items.length} tint={colors.primary} />
            <StatTile icon="play-circle" label="In progress" value={learning.inProgress.length} tint={colors.secondary} />
            <StatTile icon="ribbon" label="Completed" value={learning.completed.length} tint={colors.success} />
            <StatTile icon="checkmark-done" label="Lessons done" value={doneLessons} tint={colors.accent} />
          </View>

          <View>
            <SectionHeader title="Continue learning" action={learning.inProgress.length ? 'See all' : undefined} onAction={() => router.push('/(tabs)/learning')} />
            {learning.inProgress[0] ? (
              <LearningCard item={learning.inProgress[0]} />
            ) : (
              <Card><EmptyState icon="compass-outline" title="Nothing in progress" body="Start a new course to see it here." action="Explore courses" onAction={() => router.push('/(tabs)/explore')} /></Card>
            )}
          </View>

          {learning.recent.length > 0 && (
            <View>
              <SectionHeader title="Recently accessed" />
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {learning.recent.slice(0, 5).map((i, idx) => (
                  <View key={i.course.id} style={[styles.recentRow, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline }]}>
                    <Thumb uri={i.course.thumbnail} style={{ width: 52, height: 52 }} radius={12} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={type.bodyStrong} numberOfLines={1} onPress={() => router.push(`/learn/${i.course.id}`)}>{i.course.title}</Text>
                      <ProgressBar percent={i.completed ? 100 : i.progress.percent} height={5} />
                      <Text style={type.small}>{i.progress.lastAccessedAt ? `Opened ${timeAgo(i.progress.lastAccessedAt)}` : `Enrolled ${formatDate(i.enrolledAt)}`}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}

          <View>
            <SectionHeader title="My certificates" action="View all" onAction={() => router.push('/certificates')} />
            <Card onPress={() => router.push('/certificates')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.payIcon}><Ionicons name="ribbon-outline" size={20} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>{certs.data?.length ? `${certs.data.length} certificate${certs.data.length === 1 ? '' : 's'} earned` : 'No certificates yet'}</Text>
                <Text style={type.small}>Complete every lesson in a course to earn one</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
            </Card>
          </View>

          <View>
            <SectionHeader title="Purchase history" action="View all" onAction={() => router.push('/payments')} />
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {payments.isLoading ? (
                <Loading />
              ) : captured.length === 0 ? (
                <Text style={[type.small, { padding: 16 }]}>No purchases yet.</Text>
              ) : (
                captured.slice(0, 3).map((p, idx) => (
                  <View key={p.id} style={[styles.recentRow, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.hairline }]}>
                    <View style={styles.payIcon}><Ionicons name="receipt-outline" size={18} color={colors.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={type.bodyStrong} numberOfLines={1}>{p.courseTitle}</Text>
                      <Text style={type.small}>{formatDate(p.createdAt)}</Text>
                    </View>
                    <Text style={type.bodyStrong}>{formatPrice(p.amount, p.currency)}</Text>
                  </View>
                ))
              )}
            </Card>
          </View>

          <Button title="Account settings" icon="settings-outline" variant="outline" onPress={() => router.push('/settings')} />
        </ScrollView>
      )}
    </View>
  );
}

const StatTile: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: number; tint: string }> = ({ icon, label, value, tint }) => (
  <View style={styles.tile}>
    <View style={[styles.tileIcon, { backgroundColor: `${tint}18` }]}><Ionicons name={icon} size={20} color={tint} /></View>
    <Text style={[type.h1, { marginTop: 10 }]}>{value}</Text>
    <Text style={type.small}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20 },
  heroLabel: { fontFamily: fonts.body, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  heroValue: { fontFamily: fonts.display, fontSize: 18, color: colors.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '47%', flexGrow: 1, padding: 16, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  payIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
