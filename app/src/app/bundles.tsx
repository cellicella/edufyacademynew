import React, { useMemo } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBundles, useEnrollments } from '@/hooks/queries';
import { ScreenHeader } from '@/components/Chrome';
import { BundleCard } from '@/components/BundleCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { colors, radius } from '@/theme';
import { friendlyMessage } from '@/logic/apiErrors';

export default function BundlesScreen() {
  const insets = useSafeAreaInsets();
  const bundles = useBundles();
  const enrollments = useEnrollments();
  const owned = useMemo(() => new Set((enrollments.data || []).map((e) => e.courseId)), [enrollments.data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Course bundles" />
      {bundles.error ? (
        <ErrorState message={friendlyMessage(bundles.error)} onRetry={() => bundles.refetch()} />
      ) : bundles.isLoading ? (
        <View style={{ padding: 20, gap: 14 }}>{[0, 1].map((i) => <Skeleton key={i} style={{ height: 260, borderRadius: radius.xl }} />)}</View>
      ) : (
        <FlatList
          data={bundles.data}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => <BundleCard bundle={item} ownedCount={item.courses.filter((c) => owned.has(c.id)).length} />}
          ListEmptyComponent={<EmptyState icon="albums-outline" title="No bundles right now" body="Bundles of related courses at a combined price will appear here." />}
          refreshControl={<RefreshControl refreshing={bundles.isRefetching} onRefresh={() => { bundles.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}
        />
      )}
    </View>
  );
}
