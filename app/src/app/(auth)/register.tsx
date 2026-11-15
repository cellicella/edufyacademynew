import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { isValidEmail } from '@/logic/authErrors';
import { DEFAULT_COUNTRY, formatPhone, phoneError } from '@/logic/phone';
import { AuthShell, FormMessage } from '@/components/AuthShell';
import { Button, TextField } from '@/components/ui';
import { GoogleButton, OrDivider } from '@/components/GoogleButton';
import { PhoneField } from '@/components/PhoneField';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { config } from '@/lib/config';
import { colors, type } from '@/theme';

type Field = 'name' | 'email' | 'phone' | 'password' | 'confirm' | 'terms';

/** Password strength hint (not a requirement beyond Supabase's 6-character minimum). */
const strength = (p: string) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return p.length < 6 ? { label: 'Too short', color: colors.danger, n: 1 } : s <= 1 ? { label: 'Fair', color: colors.warning, n: 2 } : s <= 2 ? { label: 'Good', color: colors.secondary, n: 3 } : { label: 'Strong', color: colors.success, n: 4 };
};

export default function Register() {
  const { signUp } = useAuth();
  const { auth } = useSiteSettings();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agree, setAgree] = useState(false);
  const [errs, setErrs] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  const formVisible = auth.emailPasswordEnabled || !auth.googleEnabled;
  const googleFirst = auth.googleEnabled && auth.preferredMethod !== 'email';
  const legalBase = /^https:\/\//.test(config.webUrl) ? config.webUrl : '';
  const pw = strength(password);
  const clear = (f: Field) => errs[f] && setErrs((e) => ({ ...e, [f]: undefined }));

  const submit = async () => {
    setError(null);
    setExisting(false);
    const e: Partial<Record<Field, string>> = {};
    if (name.trim().length < 2) e.name = 'Enter your full name.';
    if (!isValidEmail(email)) e.email = 'Enter a valid email address.';
    const pErr = phoneError(phone, country);
    if (pErr) e.phone = pErr;
    if (password.length < 6) e.password = 'Use at least 6 characters.';
    if (confirm !== password) e.confirm = 'Passwords do not match.';
    if (legalBase && !agree) e.terms = 'Please accept the Terms and Privacy Policy.';
    setErrs(e);
    if (Object.values(e).some(Boolean)) return;
    setBusy(true);
    try {
      const r = await signUp(name, email, password, formatPhone(phone, country));
      if (r.needsVerification) setDone(email.trim());
      // otherwise (auth)/_layout redirects to the tabs once the session is stored
    } catch (err: any) {
      const msg = String(err?.message || 'Could not create your account.');
      if (/already exists/i.test(msg)) setExisting(true);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell eyebrow="Almost there" title="Check your inbox" back>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 6 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="mail-unread-outline" size={30} color={colors.primary} />
          </View>
          <Text style={[type.body, { textAlign: 'center' }]}>
            We sent a confirmation link to <Text style={type.bodyStrong}>{done}</Text>. Open it to activate your account, then sign in here.
          </Text>
          <Text style={[type.small, { textAlign: 'center' }]}>No email after a few minutes? Check your spam folder.</Text>
        </View>
        <Button title="Go to sign in" onPress={() => router.replace('/(auth)/login')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Join Edufy Academy" title="Create your account" subtitle="Start learning in minutes. Your account works on the Edufy website too.">
      <FormMessage text={error} />
      {existing && (
        <Button title="Sign in instead" variant="secondary" size="md" onPress={() => router.replace('/(auth)/login')} />
      )}
      {googleFirst && <GoogleButton label="signup_with" onError={setError} />}
      {googleFirst && formVisible && <OrDivider label="Or sign up with email" />}
      {formVisible && (
        <>
          <TextField label="Full name" icon="person-outline" value={name} onChangeText={(v) => { setName(v); clear('name'); }} autoComplete="name" textContentType="name" autoCapitalize="words" placeholder="Your full name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} error={errs.name} />
          <TextField inputRef={emailRef} label="Email address" icon="mail-outline" value={email} onChangeText={(v) => { setEmail(v); clear('email'); }} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" returnKeyType="next" error={errs.email} />
          <PhoneField country={country} onCountry={(c) => { setCountry(c); clear('phone'); }} value={phone} onChangeText={(v) => { setPhone(v); clear('phone'); }} error={errs.phone} onSubmitEditing={() => passwordRef.current?.focus()} />
          <View style={{ gap: 8 }}>
            <TextField inputRef={passwordRef} label="Password" icon="lock-closed-outline" value={password} onChangeText={(v) => { setPassword(v); clear('password'); }} secure autoComplete="new-password" textContentType="newPassword" placeholder="At least 6 characters" returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} error={errs.password} />
            {!!password && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel={`Password strength: ${pw.label}`}>
                <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
                  {[1, 2, 3, 4].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= pw.n ? pw.color : colors.border }} />)}
                </View>
                <Text style={[type.small, { color: pw.color, minWidth: 58, textAlign: 'right' }]}>{pw.label}</Text>
              </View>
            )}
          </View>
          <TextField inputRef={confirmRef} label="Confirm password" icon="lock-closed-outline" value={confirm} onChangeText={(v) => { setConfirm(v); clear('confirm'); }} secure autoComplete="new-password" placeholder="Re-enter password" returnKeyType="go" onSubmitEditing={submit} error={errs.confirm} />
          {!!legalBase && (
            <View style={{ gap: 4 }}>
              <Pressable onPress={() => { setAgree((a) => !a); clear('terms'); }} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }} accessibilityRole="checkbox" accessibilityState={{ checked: agree }} hitSlop={6}>
                <Ionicons name={agree ? 'checkbox' : 'square-outline'} size={22} color={agree ? colors.primary : colors.subtle} />
                <Text style={[type.small, { flex: 1, color: colors.text, lineHeight: 20 }]}>
                  I agree to the{' '}
                  <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => WebBrowser.openBrowserAsync(`${legalBase}/terms`)} accessibilityRole="link">Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={{ color: colors.primary, fontWeight: '600' }} onPress={() => WebBrowser.openBrowserAsync(`${legalBase}/privacy`)} accessibilityRole="link">Privacy Policy</Text>
                </Text>
              </Pressable>
              {!!errs.terms && <Text style={[type.small, { color: colors.danger }]}>{errs.terms}</Text>}
            </View>
          )}
          <Button title="Create account" icon="sparkles-outline" onPress={submit} loading={busy} />
        </>
      )}
      {!googleFirst && auth.googleEnabled && formVisible && <OrDivider label="Or" />}
      {!googleFirst && auth.googleEnabled && <GoogleButton label="signup_with" onError={setError} />}
      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        <Text style={type.body}>Already have an account?</Text>
        <Link href="/(auth)/login" replace style={[type.bodyStrong, { color: colors.primary }]}>Sign in</Link>
      </View>
    </AuthShell>
  );
}
