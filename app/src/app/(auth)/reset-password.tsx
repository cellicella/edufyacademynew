import React, { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AuthShell, FormMessage } from '@/components/AuthShell';
import { Button, Loading, TextField } from '@/components/ui';

/**
 * Opened from the password-reset email via edufyacademy://reset-password.
 * Supports the PKCE (?code=) and implicit (#access_token=) link formats.
 */
export default function ResetPassword() {
  const params = useLocalSearchParams<{ code?: string }>();
  const url = Linking.useURL();
  const { updatePassword } = useAuth();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const code = params.code || (url ? new URL(url.replace('#', '?')).searchParams.get('code') : null);
        const hash = url && url.includes('#') ? new URLSearchParams(url.split('#')[1]) : null;
        const errDesc = hash?.get('error_description') || (url ? new URL(url.replace('#', '?')).searchParams.get('error_description') : null);
        if (errDesc) throw new Error(errDesc.replace(/\+/g, ' '));
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (hash?.get('access_token') && hash.get('refresh_token')) {
          const { error } = await supabase.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! });
          if (error) throw error;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error('This reset link is invalid or has expired. Request a new one.');
        }
        setReady(true);
      } catch (e: any) {
        setLinkError(e?.message || 'This reset link is invalid or has expired.');
      }
    })();
  }, [params.code, url]);

  const submit = async () => {
    setError(null);
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await updatePassword(password);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Choose a new password" back>
      {linkError ? (
        <>
          <FormMessage text={linkError} />
          <Button title="Request a new link" onPress={() => router.replace('/(auth)/forgot-password')} />
        </>
      ) : !ready ? (
        <Loading label="Checking your reset link…" />
      ) : (
        <>
          <FormMessage text={error} />
          <TextField label="New password" icon="lock-closed-outline" value={password} onChangeText={setPassword} secure autoComplete="new-password" placeholder="At least 6 characters" />
          <TextField label="Confirm new password" icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" onSubmitEditing={submit} />
          <Button title="Update password" onPress={submit} loading={busy} />
        </>
      )}
    </AuthShell>
  );
}
