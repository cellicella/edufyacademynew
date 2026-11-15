import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { authMessage } from '@/logic/authErrors';
import { ScreenHeader } from '@/components/Chrome';
import { FormMessage } from '@/components/AuthShell';
import { Button, TextField } from '@/components/ui';
import { colors } from '@/theme';

export default function ChangePassword() {
  const { profile, session, updatePassword } = useAuth();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!current) return setError('Enter your current password.');
    if (next.length < 6) return setError('New password must be at least 6 characters.');
    if (next !== confirm) return setError('New passwords do not match.');
    if (next === current) return setError('Choose a password different from your current one.');
    setBusy(true);
    try {
      // Re-authenticate before changing the password
      const email = profile?.email || session?.user.email || '';
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (authErr) throw new Error(/invalid login credentials/i.test(authErr.message) ? 'Your current password is incorrect.' : authMessage(authErr));
      await updatePassword(next);
      setOk(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Change password" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        <FormMessage text={error} />
        <FormMessage text={ok ? 'Password updated. Use it next time you sign in on the app or website.' : null} tone="success" />
        <TextField label="Current password" icon="lock-closed-outline" value={current} onChangeText={setCurrent} secure autoComplete="password" />
        <TextField label="New password" icon="key-outline" value={next} onChangeText={setNext} secure autoComplete="new-password" placeholder="At least 6 characters" />
        <TextField label="Confirm new password" icon="key-outline" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" onSubmitEditing={submit} />
        <Button title="Update password" onPress={submit} loading={busy} />
        <Button title="Forgot your current password?" variant="ghost" onPress={() => router.push('/(auth)/forgot-password')} />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
