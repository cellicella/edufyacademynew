import React, { useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useSiteSettings, SITE_SETTINGS_KEY } from '@/hooks/useSiteSettings';
import { appMaintenanceActive, isHttps, supportContacts, updateState } from '@/logic/siteSettings';
import { config } from '@/lib/config';
import { colors, fonts, radius, type } from '@/theme';

/**
 * App-wide notices from Admin → Settings:
 *  - Maintenance announcement: full-screen message with "Try again" and "Continue" (never a hard lock).
 *  - Minimum version: blocks with an "Update" button (only when a store link is set, otherwise "Continue" stays).
 *  - Newer version available: small dismissible banner.
 */
export const AppGate: React.FC = () => {
  const s = useSiteSettings();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const [dismissedMaintenance, setDismissedMaintenance] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [dismissedSoft, setDismissedSoft] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const current = Constants.expoConfig?.version || '0.0.0';
  const update = updateState(current, s.app);
  const storeUrl = Platform.OS === 'ios' ? s.app.iosStoreUrl : s.app.androidStoreUrl;
  const canUpdate = isHttps(storeUrl);
  const maintenance = appMaintenanceActive(s.maintenance) && !dismissedMaintenance;
  const contacts = supportContacts(s, config.webUrl);

  const retry = async () => {
    setRetrying(true);
    await qc.invalidateQueries({ queryKey: SITE_SETTINGS_KEY }).catch(() => undefined);
    setRetrying(false);
  };

  if (update === 'force' && !dismissedUpdate) {
    return (
      <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => (canUpdate ? undefined : setDismissedUpdate(true))}>
        <View style={[styles.full, { paddingTop: insets.top + 40 }]}>
          <View style={styles.iconWrap}><Ionicons name="cloud-download-outline" size={34} color={colors.primary} /></View>
          <Text style={[type.h1, styles.center]}>Update required</Text>
          <Text style={[type.body, styles.center, { color: colors.muted }]}>{s.app.forceUpdateMessage}</Text>
          <Text style={[type.small, styles.center]}>Installed version {current} · minimum {s.app.minVersion}</Text>
          <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 12 }}>
            {canUpdate && <Button title="Update now" icon="arrow-up-circle-outline" onPress={() => Linking.openURL(storeUrl).catch(() => undefined)} />}
            {!canUpdate && <Button title="Continue" variant="ghost" onPress={() => setDismissedUpdate(true)} />}
          </View>
        </View>
      </Modal>
    );
  }

  if (maintenance) {
    return (
      <Modal visible animationType="fade" statusBarTranslucent onRequestClose={() => setDismissedMaintenance(true)}>
        <ScrollView contentContainerStyle={[styles.full, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.iconWrap}><Ionicons name="construct-outline" size={34} color={colors.primary} /></View>
          <Text style={[type.h1, styles.center]}>{s.maintenance.title || 'We’ll be back soon'}</Text>
          {!!s.maintenance.message && <Text style={[type.body, styles.center, { color: colors.muted }]}>{s.maintenance.message}</Text>}
          {!!s.maintenance.endsAt && (
            <Text style={[type.small, styles.center]}>Expected back: {new Date(s.maintenance.endsAt).toLocaleString()}</Text>
          )}
          {s.maintenance.showContact && (
            <View style={{ gap: 8, alignSelf: 'stretch' }}>
              {!!contacts.whatsappUrl && <Button title="WhatsApp support" icon="logo-whatsapp" variant="ghost" onPress={() => Linking.openURL(contacts.whatsappUrl!).catch(() => undefined)} />}
              {!!contacts.phone && <Button title={`Call ${contacts.phone}`} icon="call-outline" variant="ghost" onPress={() => Linking.openURL(`tel:+${contacts.phone.replace(/\D/g, '')}`).catch(() => undefined)} />}
              {!!contacts.email && <Button title={contacts.email} icon="mail-outline" variant="ghost" onPress={() => Linking.openURL(`mailto:${contacts.email}`).catch(() => undefined)} />}
            </View>
          )}
          <View style={{ gap: 10, alignSelf: 'stretch', marginTop: 8 }}>
            <Button title={retrying ? 'Checking…' : 'Try again'} icon="refresh" onPress={retry} disabled={retrying} />
            <Button title="Continue to my downloads and courses" variant="ghost" onPress={() => setDismissedMaintenance(true)} />
          </View>
        </ScrollView>
      </Modal>
    );
  }

  if (update === 'soft' && canUpdate && !dismissedSoft) {
    return (
      <View style={[styles.soft, { bottom: insets.bottom + 72 }]} accessibilityLiveRegion="polite">
        <Ionicons name="sparkles-outline" size={18} color={colors.white} />
        <Text style={styles.softText} numberOfLines={2}>A new version of {s.general.appName || 'Edufy Academy'} is available.</Text>
        <Pressable onPress={() => Linking.openURL(storeUrl).catch(() => undefined)} hitSlop={8} accessibilityRole="button"><Text style={styles.softAction}>Update</Text></Pressable>
        <Pressable onPress={() => setDismissedSoft(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss"><Ionicons name="close" size={18} color={colors.white} /></Pressable>
      </View>
    );
  }
  return null;
};

const styles = StyleSheet.create({
  full: { flexGrow: 1, backgroundColor: colors.bg, alignItems: 'center', paddingHorizontal: 28, gap: 14 },
  center: { textAlign: 'center' },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  soft: { position: 'absolute', left: 16, right: 16, zIndex: 90, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.ink, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12 },
  softText: { flex: 1, color: colors.white, fontFamily: fonts.bodyMedium, fontSize: 14 },
  softAction: { color: '#A5B8FF', fontFamily: fonts.bodySemi, fontSize: 14 },
});
