import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ScreenHeader } from '@/components/Chrome';
import { EmptyState } from '@/components/ui';
import { colors } from '@/theme';

/** Unknown routes / stale deep links */
export default function NotFound() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader />
      <EmptyState icon="compass-outline" title="Page not found" body="This link doesn’t match anything in the app." action="Go to Home" onAction={() => router.replace('/')} />
    </View>
  );
}
