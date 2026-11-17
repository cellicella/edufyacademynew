import React, { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { updateProfile, uploadAvatar } from '@/services/profile';
import { friendlyMessage } from '@/logic/apiErrors';
import { ScreenHeader } from '@/components/Chrome';
import { FormMessage } from '@/components/AuthShell';
import { Avatar, Button, Loading, TextField } from '@/components/ui';
import { colors, type } from '@/theme';

export default function EditProfile() {
  const { profile } = useAuth();
  // Wait for the profile so the form never starts empty and overwrites saved details
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Edit profile" />
        <Loading label="Loading your profile…" />
      </View>
    );
  }
  return <EditProfileForm />;
}

function EditProfileForm() {
  const { profile, session, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(profile?.fullName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatarUrl || null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
    if (res.canceled || !res.assets?.[0] || !session) return;
    const asset = res.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) return setError('Please choose an image smaller than 5 MB.');
    setUploading(true);
    try {
      const url = await uploadAvatar(session.user.id, asset.uri, asset.mimeType || 'image/jpeg', asset.base64);
      setAvatar(url);
    } catch (e: any) {
      setError(friendlyMessage(e, 'Could not upload the picture.'));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError(null);
    if (name.trim().length < 2) return setError('Enter your full name.');
    if (phone && !/^\+?[0-9\s-]{7,16}$/.test(phone.trim())) return setError('Enter a valid phone number, e.g. +91 98765 43210.');
    if (!session) return;
    setBusy(true);
    try {
      await updateProfile(session.user.id, { fullName: name, phone: phone || null, avatarUrl: avatar });
      await refreshProfile();
      router.back();
    } catch (e: any) {
      setError(friendlyMessage(e, 'Could not save your profile.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Edit profile" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={pick} style={{ alignSelf: 'center', alignItems: 'center', gap: 8 }} accessibilityRole="button" accessibilityLabel="Change profile picture">
            <View>
              <Avatar uri={avatar} name={name} size={104} />
              <View style={styles.cam}><Ionicons name={uploading ? 'cloud-upload-outline' : 'camera'} size={17} color={colors.white} /></View>
            </View>
            <Text style={[type.smallStrong, { color: colors.primary }]}>{uploading ? 'Uploading…' : 'Change photo'}</Text>
          </Pressable>
          <FormMessage text={error} />
          <TextField label="Full name" icon="person-outline" value={name} onChangeText={setName} autoComplete="name" />
          <TextField label="Email" icon="mail-outline" value={profile?.email || ''} editable={false} style={{ color: colors.muted }} />
          <Text style={[type.small, { marginTop: -10 }]}>Email changes are handled by Edufy support.</Text>
          <TextField label="Phone number" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="+91 98765 43210" />
          <Button title="Save changes" onPress={save} loading={busy} disabled={uploading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  cam: { position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, borderWidth: 3, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
