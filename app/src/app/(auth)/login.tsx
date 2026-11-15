import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { isValidEmail } from '@/logic/authErrors';
import { AuthShell, FormMessage } from '@/components/AuthShell';
import { Button, TextField } from '@/components/ui';
import { GoogleButton, OrDivider } from '@/components/GoogleButton';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { colors, type } from '@/theme';

export default function Login() {
  const { signIn } = useAuth();
  const { auth } = useSiteSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Email & password can be hidden by the admin only while Google is on; staff can still reveal it here
  const [showEmail, setShowEmail] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const emailVisible = auth.emailPasswordEnabled || !auth.googleEnabled || showEmail;
  const googleFirst = auth.googleEnabled && auth.preferredMethod !== 'email';

  const submit = async () => {
    setError(null);
    const errs: typeof fieldErrors = {};
    if (!isValidEmail(email)) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Enter your password.';
    setFieldErrors(errs);
    if (errs.email || errs.password) return;
    setBusy(true);
    try {
      await signIn(email, password);
      // (auth)/_layout redirects to the tabs as soon as the session is stored
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const emailForm = (
    <>
      <TextField
        label="Email address" icon="mail-outline" value={email}
        onChangeText={(v) => { setEmail(v); if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined })); }}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
        placeholder="you@example.com" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} error={fieldErrors.email}
      />
      <TextField
        inputRef={passwordRef}
        label="Password" icon="lock-closed-outline" value={password}
        onChangeText={(v) => { setPassword(v); if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined })); }}
        secure autoComplete="password" textContentType="password" placeholder="Your password" onSubmitEditing={submit} returnKeyType="go" error={fieldErrors.password}
      />
      <Link href="/(auth)/forgot-password" style={[type.smallStrong, { color: colors.primary, alignSelf: 'flex-end', paddingVertical: 2 }]}>Forgot password?</Link>
      <Button title="Sign in" icon="arrow-forward" onPress={submit} loading={busy} />
    </>
  );

  return (
    <AuthShell eyebrow="Welcome back" title="Sign in to keep learning" subtitle="Pick up your courses where you left off. One account for the Edufy website and app.">
      <FormMessage text={error} />
      {googleFirst && <GoogleButton label={auth.googleButtonText} onError={setError} />}
      {googleFirst && emailVisible && <OrDivider label="Or continue with email" />}
      {emailVisible && emailForm}
      {!googleFirst && auth.googleEnabled && emailVisible && <OrDivider label="Or" />}
      {!googleFirst && auth.googleEnabled && <GoogleButton label={auth.googleButtonText} onError={setError} />}
      {!emailVisible && (
        <Pressable onPress={() => setShowEmail(true)} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
          <Text style={[type.smallStrong, { color: colors.primary }]}>Sign in with email instead</Text>
        </Pressable>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        <Text style={type.body}>New to Edufy?</Text>
        <Link href="/(auth)/register" replace style={[type.bodyStrong, { color: colors.primary }]}>Create an account</Link>
      </View>
    </AuthShell>
  );
}
