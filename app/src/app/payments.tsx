import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { usePayments } from '@/hooks/queries';
import { ScreenHeader } from '@/components/Chrome';
import { Thumb } from '@/components/CourseCards';
import { Badge, EmptyState, ErrorState, Loading } from '@/components/ui';
import { colors, radius, type } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { friendlyMessage } from '@/logic/apiErrors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'primary' }> = {
  captured: { label: 'Paid', tone: 'success' },
  created: { label: 'Not completed', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'primary' },
};

export default function Payments() {
  const insets = useSafeAreaInsets();
  const payments = usePayments();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Payment history" />
      {payments.error ? (
        <ErrorState message={friendlyMessage(payments.error)} onRetry={() => payments.refetch()} />
      ) : payments.isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={payments.data}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 20, gap: 12, flexGrow: 1, paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={payments.isRefetching} onRefresh={() => { payments.refetch(); }} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="No payments yet" body="Your course purchases will be listed here." action="Explore courses" onAction={() => router.push('/(tabs)/explore')} />}
          renderItem={({ item: p }) => {
            const s = STATUS[p.status] || { label: p.status, tone: 'primary' as const };
            return (
              <View style={styles.card}>
                <Thumb uri={p.thumbnail} style={{ width: 64, height: 64 }} radius={radius.sm} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={type.bodyStrong} numberOfLines={2}>{p.courseTitle}</Text>
                  <Text style={type.small}>{formatDate(p.createdAt)}</Text>
                  <Text style={[type.small, { fontSize: 11.5 }]} selectable numberOfLines={1}>
                    {p.paymentId ? `Payment ${p.paymentId}` : `Order ${p.orderId}`}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={type.bodyStrong}>{formatPrice(p.amount, p.currency)}</Text>
                  <Badge label={s.label} tone={s.tone} />
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
});
