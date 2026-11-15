import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { friendlyOAuthError } from '@/logic/oauth';
import { Button } from '@/components/ui';
import { colors, type } from '@/theme';

/**
 * edufyacademy://auth/callback — normally consumed by the Google sign-in browser session. If Android hands the
 * link to the app instead, finish the sign-in here (the PKCE verifier is in this phone's secure storage).
 */
export default function AuthCallback() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (error_description) return setError(friendlyOAuthError(String(error_description)));
      // The browser session may already be exchanging this code: wait briefly for its session first
      for (let i = 0; i < 6; i++) {
        if ((await supabase.auth.getSession()).data.session) return alive && router.replace('/');
        await new Promise((r) => setTimeout(r, 250));
      }
      if (code) {
        const { error: e } = await supabase.auth.exchangeCodeForSession(String(code));
        if (e && !(await supabase.auth.getSession()).data.session) return alive && setError(friendlyOAuthError(e.message));
      }
      if (alive) router.replace('/');
    })();
    return () => {
      alive = false;
    };
  }, [code, error_description]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.bg }}>
      {error ? (
        <>
          <Text style={[type.h2, { textAlign: 'center' }]}>Sign-in not completed</Text>
          <Text style={[type.body, { textAlign: 'center', color: colors.muted }]}>{error}</Text>
          <Button title="Back to sign in" onPress={() => router.replace('/(auth)/login')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={type.body}>Signing you in…</Text>
        </>
      )}
    </View>
  );
}
