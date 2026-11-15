import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function AuthLayout() {
  const { session, initializing } = useAuth();
  const path = usePathname();
  // Signed-in users skip the auth screens (except while setting a new password)
  if (!initializing && session && !path.includes('reset-password')) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
