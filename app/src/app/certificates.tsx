import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useCertificates, useMyLearning, qk } from '@/hooks/queries';
import { useAuth } from '@/context/AuthContext';
import { claimCertificate } from '@/services/certificates';
import { ScreenHeader } from '@/components/Chrome';
import { Thumb } from '@/components/CourseCards';
import { Button, EmptyState, ErrorState, Loading } from '@/components/ui';
import { colors, radius, shadow, type } from '@/theme';
import { formatIssueDate, isCourseComplete } from '@/logic/certificates';
import { friendlyMessage } from '@/logic/apiErrors';

export default function CertificatesScreen() {
  const { claim } = useLocalSearchParams<{ claim?: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { session } = useAuth();
  const certs = useCertificates();
  const learning = useMyLearning();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<{ courseId: string; message: string } | null>(null);

  const certCourseIds = useMemo(() => new Set((certs.data || []).map((c) => c.courseId)), [certs.data]);
  // Completed courses (same rule as the server) without a certificate yet
  const eligible = useMemo(
    () => learning.items.filter((i) => isCourseComplete(i.progress) && !certCourseIds.has(i.course.id)).sort((a, b) => Number(b.course.id === claim) - Number(a.course.id === claim)),
    [learning.items, certCourseIds, claim]
  );

  const doClaim = async (courseId: string) => {
    if (claiming) return;
    setClaiming(courseId);
    setClaimError(null);
    try {
      // The server re-checks enrollment and completion and never issues a duplicate
      const { certificate } = await claimCertificate(courseId);
      await qc.invalidateQueries({ queryKey: qk.certificates(session?.user.id) });
      await qc.invalidateQueries({ queryKey: qk.enrollments(session?.user.id) });
      router.push(`/certificate/${certificate.id}`);
    } catch (e) {
      setClaimError({ courseId, message: friendlyMessage(e, 'Could not issue the certificate.') });
    } finally {
      setClaiming(null);
    }
  };

  const loading = certs.isLoading || learning.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="My certificates" right={<Ionicons name="shield-checkmark-outline" size={22} color={colors.ink} onPress={() => router.push('/verify-certificate')} accessibilityLabel="Verify a certificate" />} />
      {certs.error && !certs.data ? (
        <ErrorState message={friendlyMessage(certs.error)} onRetry={() => certs.refetch()} />
      ) : loading ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 32, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={certs.isRefetching} onRefresh={() => { certs.refetch(); learning.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {eligible.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={type.h3}>Ready to claim</Text>
              {eligible.map((i) => (
                <View key={i.course.id} style={[styles.card, i.course.id === claim && { borderColor: colors.accent }]}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <Thumb uri={i.course.thumbnail} style={{ width: 56, height: 56 }} radius={radius.sm} />
                    <View style={{ flex: 1 }}>
                      <Text style={type.bodyStrong} numberOfLines={2}>{i.course.title}</Text>
                      <Text style={type.small}>All {i.progress.total} lessons completed</Text>
                    </View>
                  </View>
                  {claimError?.courseId === i.course.id && <Text style={[type.small, { color: colors.danger, marginTop: 8 }]}>{claimError.message}</Text>}
                  <Button title="Get certificate" icon="ribbon-outline" size="md" loading={claiming === i.course.id} disabled={!!claiming} onPress={() => doClaim(i.course.id)} style={{ marginTop: 12 }} />
                </View>
              ))}
            </View>
          )}

          <Text style={[type.h3, { marginTop: eligible.length ? 8 : 0 }]}>Earned certificates</Text>
          {(certs.data || []).length === 0 ? (
            <EmptyState icon="ribbon-outline" title="No certificates yet" body="Complete every lesson in a course to earn a verifiable certificate." action="Go to My Learning" onAction={() => router.push('/(tabs)/learning')} />
          ) : (
            certs.data!.map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/certificate/${c.id}`)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]} accessibilityRole="button">
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View style={styles.badge}><Ionicons name="ribbon" size={24} color={colors.white} /></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={type.bodyStrong} numberOfLines={2}>{c.courseTitle}</Text>
                    <Text style={type.small}>Completed {formatIssueDate(c.issueDate)}</Text>
                    <Text style={[type.small, { fontFamily: 'Inter_600SemiBold', color: colors.primary }]}>{c.code}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
                </View>
              </Pressable>
            ))
          )}

          <Pressable onPress={() => router.push('/verify-certificate')} style={styles.verify} accessibilityRole="button">
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <Text style={[type.bodyStrong, { flex: 1 }]}>Verify a certificate ID</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, ...shadow },
  badge: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  verify: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginTop: 8, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
});
