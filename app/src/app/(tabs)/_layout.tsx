import React from 'react';
import { ColorValue, Platform } from 'react-native';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;
// react-navigation passes `color` as a ColorValue; the tab tint colours we set are plain strings
const icon = (on: IconName, off: IconName) => ({ color, focused }: { color: ColorValue; focused: boolean; size: number }) => (
  <Ionicons name={focused ? on : off} size={23} color={color as string} />
);

export default function TabsLayout() {
  const { session, initializing } = useAuth();
  const insets = useSafeAreaInsets();
  if (!initializing && !session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtle,
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11.5, marginTop: 2 },
        tabBarStyle: {
          height: 62 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopColor: colors.border,
          backgroundColor: colors.white,
          ...(Platform.OS === 'android' ? { elevation: 12 } : {}),
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: icon('compass', 'compass-outline') }} />
      <Tabs.Screen name="learning" options={{ title: 'My Learning', tabBarIcon: icon('play-circle', 'play-circle-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
