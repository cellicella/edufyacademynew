import React, { useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useCertificates } from '@/hooks/queries';
import { ScreenHeader } from '@/components/Chrome';
import { CertificateView } from '@/components/CertificateView';
import { Button, ErrorState, Loading } from '@/components/ui';
import { config } from '@/lib/config';
import { qrSvg } from '@/lib/qr';
import { certificateHtml, formatIssueDate, verificationUrl } from '@/logic/certificates';
import { friendlyMessage } from '@/logic/apiErrors';
import { colors, radius, type } from '@/theme';

export default function CertificateDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const certs = useCertificates();
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (certs.isLoading) return <View style={{ flex: 1 }}><ScreenHeader title="Certificate" /><Loading /></View>;
  const cert = certs.data?.find((c) => c.id === id || c.code === id);
  if (!cert) {
    return (
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Certificate" />
        <ErrorState message={certs.error ? friendlyMessage(certs.error) : 'Certificate not found in your account.'} onRetry={() => certs.refetch()} />
      </View>
    );
  }

  const verifyUrl = verificationUrl(config.webUrl, cert.code);
  const html = () => certificateHtml(cert, { verifyUrl, qrSvg: qrSvg(verifyUrl) });
  const fileName = `Edufy-Certificate-${cert.code}`;

  /** Android print dialog → "Save as PDF" stores the file on the device. */
  const savePdf = async () => {
    setBusy('save');
    setError(null);
    try {
      await Print.printAsync({ html: html(), orientation: Print.Orientation.landscape });
    } catch (e) {
      setError(friendlyMessage(e, 'Could not create the PDF.'));
    } finally {
      setBusy(null);
    }
  };

  /** Creates the PDF file and opens the native share sheet (WhatsApp, Gmail, Drive…). */
  const sharePdf = async () => {
    setBusy('share');
    setError(null);
    try {
      const { uri } = await Print.printToFileAsync({ html: html(), width: 842, height: 595 });
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fileName, UTI: 'com.adobe.pdf' });
    } catch (e) {
      setError(friendlyMessage(e, 'Could not share the certificate.'));
    } finally {
      setBusy(null);
    }
  };

  const shareLink = () =>
    Share.share({ message: `I completed “${cert.courseTitle}” on Edufy Academy! Verify my certificate (${cert.code}): ${verifyUrl}` }).catch(() => undefined);

  const previewWidth = Math.min(width - 40, 720);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Certificate" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: insets.bottom + 32, alignItems: 'center' }}>
        <CertificateView cert={cert} width={previewWidth} verifyUrl={verifyUrl} />

        <View style={[styles.card, { width: previewWidth }]}>
          <Row icon="school-outline" label="Course" value={cert.courseTitle} />
          <Row icon="person-outline" label="Awarded to" value={cert.studentName} />
          <Row icon="calendar-outline" label="Completed" value={formatIssueDate(cert.issueDate)} />
          <Row icon="key-outline" label="Certificate ID" value={cert.code} selectable />
          <Row icon="business-outline" label="Issuer" value="Edufy Academy" />
        </View>

        {!!error && <Text style={[type.small, { color: colors.danger, alignSelf: 'stretch' }]}>{error}</Text>}

        <View style={{ gap: 10, width: previewWidth }}>
          <Button title="Download PDF" icon="download-outline" loading={busy === 'save'} disabled={!!busy} onPress={savePdf} />
          <Button title="Share PDF" icon="share-social-outline" variant="secondary" loading={busy === 'share'} disabled={!!busy} onPress={sharePdf} />
          <Button title="Share verification link" icon="link-outline" variant="outline" onPress={shareLink} />
          {!!config.webUrl && <Button title="Verify online" icon="shield-checkmark-outline" variant="ghost" onPress={() => Linking.openURL(verifyUrl)} />}
        </View>
        <Text style={[type.small, { textAlign: 'center' }]}>“Download PDF” opens Android’s print screen — choose “Save as PDF”.</Text>
      </ScrollView>
    </View>
  );
}

const Row: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string; selectable?: boolean }> = ({ icon, label, value, selectable }) => (
  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
    <Ionicons name={icon} size={18} color={colors.primary} style={{ marginTop: 2 }} />
    <Text style={[type.small, { width: 100 }]}>{label}</Text>
    <Text style={[type.bodyStrong, { flex: 1 }]} selectable={selectable}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
});
