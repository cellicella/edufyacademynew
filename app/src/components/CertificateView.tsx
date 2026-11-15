import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Certificate, formatIssueDate } from '@/logic/certificates';
import { QRCode } from './QRCode';
import { colors, fonts } from '@/theme';

/**
 * On-screen certificate preview (A4 landscape proportions). Scales with `width`.
 * The downloadable PDF uses the same content and layout (logic/certificates.ts → certificateHtml).
 */
export const CertificateView: React.FC<{ cert: Certificate; width: number; verifyUrl: string }> = ({ cert, width, verifyUrl }) => {
  const h = width / 1.414;
  const u = width / 100; // 1 unit = 1% of the width
  return (
    <View style={[styles.outer, { width, height: h, borderRadius: u * 2, padding: u * 1.6 }]}>
      <LinearGradient colors={['#FFFFFF', '#F5F8FF', '#EEF1FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.inner, { borderRadius: u * 1.4, borderWidth: Math.max(1, u * 0.25), paddingHorizontal: u * 5, paddingVertical: u * 3.6 }]}>
        <View style={[styles.glow, { width: u * 40, height: u * 40, borderRadius: u * 20, right: -u * 12, top: -u * 14 }]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: u * 1.4 }}>
          <Image source={require('../../assets/images/logo.png')} style={{ width: u * 5.4, height: u * 5.4 }} />
          <View>
            <Text style={{ fontFamily: fonts.display, fontSize: u * 2.7, color: colors.ink }}>
              Edufy <Text style={{ color: colors.secondary }}>Academy</Text>
            </Text>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: u * 1, letterSpacing: u * 0.3, color: colors.muted }}>EXCELLENCE IN LEARNING</Text>
          </View>
        </View>

        <Text style={{ marginTop: u * 3.4, fontFamily: fonts.bodyBold, fontSize: u * 1.5, letterSpacing: u * 0.5, color: colors.accent }}>CERTIFICATE OF COMPLETION</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: u * 2.4, color: colors.primary, marginTop: u * 0.6 }}>This certifies that</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.display, fontSize: u * 4.6, color: colors.ink, marginTop: u * 0.8 }}>{cert.studentName}</Text>
        <View style={{ height: Math.max(1, u * 0.15), backgroundColor: '#CBD5E1', width: '62%', marginTop: u * 0.6 }} />
        <Text style={{ fontFamily: fonts.body, fontSize: u * 1.5, color: colors.text, marginTop: u * 1.6 }}>has successfully completed all lessons of the course</Text>
        <Text numberOfLines={2} style={{ fontFamily: fonts.displayBold, fontSize: u * 2.4, color: colors.ink, marginTop: u * 0.8, maxWidth: '75%' }}>{cert.courseTitle}</Text>

        <View style={[styles.footer, { left: u * 5, right: u * 5, bottom: u * 3.4 }]}>
          <View style={{ gap: u * 0.4, flex: 1 }}>
            <Text style={[styles.meta, { fontSize: u * 1.15 }]}>Completed on <Text style={styles.metaB}>{formatIssueDate(cert.issueDate)}</Text></Text>
            <Text style={[styles.meta, { fontSize: u * 1.15 }]}>Certificate ID <Text style={styles.metaB}>{cert.code}</Text></Text>
            <Text style={[styles.meta, { fontSize: u * 1.15 }]}>Issued by <Text style={styles.metaB}>Edufy Academy</Text></Text>
          </View>
          <View style={{ alignItems: 'center', marginHorizontal: u * 2 }}>
            <View style={{ width: u * 18, height: Math.max(1, u * 0.15), backgroundColor: colors.ink, marginBottom: u * 0.6 }} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: u * 1.25, color: colors.ink }} numberOfLines={1}>{cert.instructorName || 'Edufy Academy'}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: u * 1.05, color: colors.muted }}>Course Instructor</Text>
          </View>
          <View style={{ alignItems: 'center', gap: u * 0.4 }}>
            <QRCode value={verifyUrl} size={u * 10} />
            <Text style={{ fontFamily: fonts.body, fontSize: u * 0.9, color: colors.muted }}>Scan to verify</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: { backgroundColor: colors.primary },
  inner: { flex: 1, borderColor: 'rgba(82,113,255,0.45)', overflow: 'hidden' },
  glow: { position: 'absolute', backgroundColor: 'rgba(94,23,235,0.07)' },
  footer: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end' },
  meta: { fontFamily: fonts.body, color: colors.text },
  metaB: { fontFamily: fonts.bodySemi, color: colors.ink },
});
