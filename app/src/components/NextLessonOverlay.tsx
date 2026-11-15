import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AfterEnd, AUTOPLAY_SECONDS } from '@/logic/autoplay';
import { Thumb } from './CourseCards';
import { colors, fonts, radius } from '@/theme';
import { formatMinutes } from '@/utils/format';

/**
 * Shown over the player after a lesson video genuinely ends.
 * Countdown pauses (and autoplay is cancelled) if the app goes to the background.
 */
export const NextLessonOverlay: React.FC<{
  decision: AfterEnd;
  thumbnail: string | null;
  autoplayEnabled: boolean;
  onToggleAutoplay: (v: boolean) => void;
  onPlayNext: () => void;
  onDismiss: () => void;
  onCourseComplete: () => void;
}> = ({ decision, thumbnail, autoplayEnabled, onToggleAutoplay, onPlayNext, onDismiss, onCourseComplete }) => {
  const counting = decision.kind === 'next' && decision.autoplay;
  const [seconds, setSeconds] = useState(AUTOPLAY_SECONDS);
  const [cancelled, setCancelled] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (!counting || cancelled) return;
    const sub = AppState.addEventListener('change', (s) => s !== 'active' && setCancelled(true));
    const t = setInterval(() => setSeconds((v) => v - 1), 1000);
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [counting, cancelled]);

  useEffect(() => {
    if (counting && !cancelled && seconds <= 0 && !fired.current) {
      fired.current = true; // never start two lessons
      onPlayNext();
    }
  }, [seconds, counting, cancelled, onPlayNext]);

  return (
    <View style={styles.wrap} accessibilityViewIsModal>
      {decision.kind === 'next' && (
        <View style={styles.row}>
          <Thumb uri={thumbnail} style={styles.thumb} radius={radius.sm} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>{counting && !cancelled ? `Up next in ${Math.max(0, seconds)}s` : 'Up next'}</Text>
            <Text style={styles.title} numberOfLines={2}>{decision.lesson.title}</Text>
            <Text style={styles.sub}>{decision.lesson.type === 'video' ? 'Video' : decision.lesson.type === 'article' ? 'Article' : 'Quiz'} · {formatMinutes(decision.lesson.durationMinutes)}</Text>
          </View>
        </View>
      )}
      {decision.kind === 'locked' && (
        <View style={styles.row}>
          <Ionicons name="lock-closed" size={26} color={colors.white} />
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Next lesson is locked</Text>
            <Text style={styles.title} numberOfLines={2}>{decision.lesson.title}</Text>
            <Text style={styles.sub}>Enroll in the course to continue.</Text>
          </View>
        </View>
      )}
      {decision.kind === 'course_complete' && (
        <View style={styles.row}>
          <Ionicons name="trophy" size={30} color="#FBBF24" />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Course complete! 🎉</Text>
            <Text style={styles.sub}>You finished every lesson. Claim your certificate.</Text>
          </View>
        </View>
      )}
      {decision.kind === 'last_lesson' && (
        <View style={styles.row}>
          <Ionicons name="flag" size={26} color={colors.white} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>That was the last lesson</Text>
            <Text style={styles.sub}>{decision.remaining} lesson{decision.remaining === 1 ? '' : 's'} still to complete for your certificate.</Text>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable onPress={onDismiss} style={[styles.btn, styles.ghost]} accessibilityRole="button" hitSlop={6}>
          <Text style={styles.btnText}>{counting && !cancelled ? 'Cancel' : 'Close'}</Text>
        </Pressable>
        {decision.kind === 'next' && (
          <Pressable onPress={() => { if (!fired.current) { fired.current = true; onPlayNext(); } }} style={[styles.btn, styles.primary]} accessibilityRole="button" hitSlop={6}>
            <Ionicons name="play" size={15} color={colors.primary} />
            <Text style={[styles.btnText, { color: colors.primary }]}>{decision.lesson.type === 'video' ? 'Play next now' : 'Open next'}</Text>
          </Pressable>
        )}
        {decision.kind === 'course_complete' && (
          <Pressable onPress={onCourseComplete} style={[styles.btn, styles.primary]} accessibilityRole="button">
            <Ionicons name="ribbon" size={15} color={colors.primary} />
            <Text style={[styles.btnText, { color: colors.primary }]}>Get certificate</Text>
          </Pressable>
        )}
      </View>
      {decision.kind === 'next' && decision.lesson.type === 'video' && (
        <View style={styles.toggle}>
          <Text style={styles.sub}>Autoplay next lesson</Text>
          <Switch value={autoplayEnabled} onValueChange={(v) => { onToggleAutoplay(v); if (!v) setCancelled(true); }} trackColor={{ true: colors.secondary, false: '#475569' }} thumbColor={colors.white} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,18,32,0.9)', padding: 14, justifyContent: 'center', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 96, height: 54 },
  eyebrow: { fontFamily: fonts.bodySemi, fontSize: 12, color: '#A5B8FF' },
  title: { fontFamily: fonts.displayBold, fontSize: 15, color: colors.white },
  sub: { fontFamily: fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 16, borderRadius: 19 },
  ghost: { backgroundColor: 'rgba(255,255,255,0.14)' },
  primary: { backgroundColor: colors.white },
  btnText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.white },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: -4 },
});
