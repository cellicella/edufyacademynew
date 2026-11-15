import React, { useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { isValidEmail } from '@/logic/authErrors';
import { AuthShell, FormMessage } from '@/components/AuthShell';
import { Button, TextField } from '@/components/ui';

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!isValidEmail(email)) return setError('Enter a valid email address.');
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email and we’ll send you a reset link." back>
      <FormMessage text={error} />
      {sent ? (
        <>
          <FormMessage tone="success" text={`If an account exists for ${email.trim()}, a reset link is on its way. Open the link on this phone to choose a new password.`} />
          <Button title="Back to sign in" variant="secondary" onPress={() => router.replace('/(auth)/login')} />
        </>
      ) : (
        <>
          <TextField label="Email" icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" onSubmitEditing={submit} />
          <Button title="Send reset link" onPress={submit} loading={busy} />
        </>
      )}
    </AuthShell>
  );
}
