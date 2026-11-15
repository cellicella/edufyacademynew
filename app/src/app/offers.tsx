import React from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOffers } from '@/hooks/engagement';
import { ScreenHeader } from '@/components/Chrome';
import { OfferCard, SlideUp } from '@/components/Engagement';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { colors, radius } from '@/theme';
import { friendlyMessage } from '@/logic/apiErrors';

export default function OffersScreen() {
  const insets = useSafeAreaInsets();
  const offers = useOffers();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Special offers" />
      {offers.error ? (
        <ErrorState message={friendlyMessage(offers.error)} onRetry={() => offers.refetch()} />
      ) : offers.isLoading ? (
        <View style={{ padding: 20, gap: 14 }}>{[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 210, borderRadius: radius.xl }} />)}</View>
      ) : (
        <FlatList
          data={offers.data}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={offers.isRefetching} onRefresh={async () => { await offers.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item, index }) => (
            <SlideUp index={index}>
              <OfferCard offer={item} onPress={() => router.push(`/offer/${item.id}`)} />
            </SlideUp>
          )}
          ListEmptyComponent={<EmptyState icon="pricetags-outline" title="No offers right now" body="We’ll notify you when a new offer starts." action="Explore courses" onAction={() => router.push('/(tabs)/explore')} />}
        />
      )}
    </View>
  );
}
