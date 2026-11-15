import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { verifyCertificate } from '@/services/certificates';
import { ScreenHeader } from '@/components/Chrome';
import { Button, TextField } from '@/components/ui';
import { Certificate, CERT_CODE_RE, formatIssueDate, normaliseCertCode } from '@/logic/certificates';
import { friendlyMessage } from '@/logic/apiErrors';
import { colors, radius, type } from '@/theme';

/** Public verification using the existing /api/certificates/verify/:code endpoint. */
export default function VerifyCertificate() {
  const params = useLocalSearchParams<{ code?: string }>();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState(params.code ? normaliseCertCode(params.code) : '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ cert: Certificate | null; error?: string } | null>(null);

  const verify = async () => {
    const c = normaliseCertCode(code);
    if (!CERT_CODE_RE.test(c)) {
      setResult({ cert: null, error: 'Enter a certificate ID like EDFY-2026-A1B2C3.' });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const cert = await verifyCertificate(c);
      setResult(cert ? { cert } : { cert: null, error: `No Edufy certificate exists with ID ${c}.` });
    } catch (e) {
      setResult({ cert: null, error: friendlyMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Verify certificate" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
          <Text style={type.body}>Enter the certificate ID printed on an Edufy Academy certificate to confirm it is genuine.</Text>
          <TextField label="Certificate ID" icon="key-outline" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="EDFY-2026-A1B2C3" onSubmitEditing={verify} returnKeyType="search" />
          <Button title="Verify" icon="shield-checkmark-outline" loading={busy} onPress={verify} />
          {result?.cert && (
            <View style={[styles.result, { borderColor: colors.success }]} accessibilityLiveRegion="polite">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                <Text style={[type.h3, { color: colors.success }]}>Valid certificate</Text>
              </View>
              <Text style={type.body}><Text style={type.bodyStrong}>{result.cert.studentName}</Text> completed</Text>
              <Text style={type.h3}>{result.cert.courseTitle}</Text>
              <Text style={type.small}>Completed {formatIssueDate(result.cert.issueDate)} · ID {result.cert.code}</Text>
              <Text style={type.small}>Issued by Edufy Academy</Text>
            </View>
          )}
          {result && !result.cert && (
            <View style={[styles.result, { borderColor: colors.danger }]} accessibilityLiveRegion="polite">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="close-circle" size={24} color={colors.danger} />
                <Text style={[type.h3, { color: colors.danger }]}>Not verified</Text>
              </View>
              <Text style={type.body}>{result.error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  result: { gap: 6, padding: 16, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1.5 },
});
