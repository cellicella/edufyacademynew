import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '@/context/AuthContext';
import { lessonVideoQuery, useCourse, useIsEnrolled, useProgress } from '@/hooks/queries';
import { useAdiloTracking } from '@/hooks/useAdiloTracking';
import { setLessonComplete, touchLesson } from '@/services/learning';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Curriculum } from '@/components/Curriculum';
import { Button, ErrorState, Loading, ProgressBar } from '@/components/ui';
import { config } from '@/lib/config';
import { Lesson } from '@/lib/types';
import { colors, fonts, gradients, radius, type } from '@/theme';
import { formatMinutes } from '@/utils/format';
import { resolveVideo } from '@/utils/video';
import { isAdiloLesson } from '@/logic/courses';
import { canOpenLesson, hasFullAccess, neighbours, pickStartLesson } from '@/logic/learningNav';
import { AfterEnd, decideAfterEnd } from '@/logic/autoplay';
import { isCourseComplete } from '@/logic/certificates';
import { useAutoplayPref } from '@/hooks/useAutoplayPref';
import { NextLessonOverlay } from '@/components/NextLessonOverlay';
import { friendlyMessage } from '@/logic/apiErrors';

const isAdilo = isAdiloLesson;
const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function LearnScreen() {
  const { courseId, lesson: lessonParam } = useLocalSearchParams<{ courseId: string; lesson?: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { session } = useAuth();
  const uid = session?.user.id;
  const course = useCourse(courseId);
  const { enrolled, isLoading: enrolLoading } = useIsEnrolled(course.data?.id);
  // Progress is requested together with the course (not after it): the course id is already known from the link
  const progressCourseId = course.data?.id || courseId;
  const progress = useProgress(uid && progressCourseId ? [progressCourseId] : []);
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const lessons = useMemo(() => (course.data?.sections || []).flatMap((s) => s.lessons), [course.data]);
  const p = course.data ? progress.data?.[course.data.id] : undefined;
  const completed = useMemo(() => new Set([...(p?.completedLessonIds || []), ...localDone]), [p, localDone]);
  // The database (row-level security) only returns full non-preview lessons to students with access, so the
  // player does not have to wait for the enrollment list. Progress writes still use the real enrollment.
  const access = useMemo(() => enrolled || hasFullAccess(lessons), [enrolled, lessons]);
  const canOpen = useCallback((l: Lesson) => canOpenLesson(l, access), [access]);

  // Choose the starting lesson once data is ready (see logic/learningNav.ts)
  useEffect(() => {
    if (lessonId || !lessons.length || (enrolLoading && !access) || (access && progress.isLoading)) return;
    const start = pickStartLesson(lessons, { requestedId: lessonParam, lastLessonId: p?.lastLessonId, completed, enrolled: access });
    if (start) setLessonId(start.id);
  }, [lessons, lessonParam, p, completed, access, enrolLoading, progress.isLoading, lessonId]);

  // A different lesson requested via params (e.g. from course details) while the screen is open
  useEffect(() => {
    if (lessonParam && lessons.some((l) => l.id === lessonParam)) setLessonId(lessonParam);
  }, [lessonParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const nav = neighbours(lessons, lessonId, access);
  const idx = nav.index;
  const lesson = idx >= 0 ? lessons[idx] : null;
  const prev = nav.prev;
  const next = nav.next;
  const openable = !!lesson && canOpen(lesson);

  // Record "last opened" for resume / continue learning
  useEffect(() => {
    if (uid && lesson && enrolled && openable && course.data) touchLesson(uid, course.data.id, lesson.id).catch((e) => __DEV__ && console.warn('[learn] could not record last lesson:', e?.message));
  }, [uid, lesson?.id, enrolled, openable, course.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Adilo: the player starts straight away from the lesson's player link (returned by the database only to
  // students with access). The existing enrollment-checked endpoint runs in parallel for the resume position
  // and verified watch time; if it denies access, the player is removed.
  const adiloActive = !!lesson && openable && isAdilo(lesson);
  const video = useQuery({ ...lessonVideoQuery(lesson?.id || '', uid), enabled: adiloActive });
  const directSrc = useMemo(() => (adiloActive ? resolveVideo(lesson!.adiloEmbedUrl) : null), [adiloActive, lesson?.adiloEmbedUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const apiSrc = useMemo(() => (video.data ? resolveVideo(video.data.embedUrl) : null), [video.data?.embedUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  const videoDenied = [403, 404].includes(Number((video.error as { status?: number } | null)?.status));
  const adiloSrc = videoDenied ? null : directSrc || apiSrc;

  const fileSrc = useMemo(() => (lesson && !isAdilo(lesson) ? resolveVideo(lesson.videoUrl) : null), [lesson?.id, lesson?.videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warm the next lesson's video details while this one plays
  useEffect(() => {
    if (!next || !uid || !canOpen(next) || !isAdilo(next)) return;
    const t = setTimeout(() => qc.prefetchQuery(lessonVideoQuery(next.id, uid)).catch(() => undefined), 4000);
    return () => clearTimeout(t);
  }, [next?.id, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const onVideoCompleted = useCallback(() => {
    if (!lesson) return;
    setLocalDone((s) => new Set(s).add(lesson.id));
    qc.invalidateQueries({ queryKey: ['progress'] });
    showToast('Lesson complete — great work!');
  }, [lesson, qc, showToast]);

  /* ---------------------------------------------------------- autoplay next lesson */
  const [autoplayEnabled, setAutoplayEnabled] = useAutoplayPref();
  const [afterEnd, setAfterEnd] = useState<{ forLesson: string; decision: AfterEnd } | null>(null);
  // Any lesson change (manual or automatic) closes the overlay
  useEffect(() => setAfterEnd(null), [lessonId]);

  const latest = useRef({ lessons, enrolled, completed, autoplayEnabled });
  latest.current = { lessons, enrolled, completed, autoplayEnabled };

  /** Only called after a genuine player "ended" event and after its progress was saved. */
  const onLessonEnded = useCallback((endedId: string) => {
    const { lessons: ls, enrolled: en, completed: done, autoplayEnabled: ap } = latest.current;
    setAfterEnd({ forLesson: endedId, decision: decideAfterEnd(ls, endedId, { enrolled: en, completed: done, autoplayEnabled: ap }) });
  }, []);

  const onPlayerEvent = useAdiloTracking(
    lesson && isAdilo(lesson) ? lesson.id : null,
    { watched: video.data?.progress?.watched_seconds || 0, duration: video.data?.durationSeconds || 0 },
    onVideoCompleted,
    onLessonEnded
  );

  // Uploaded/direct video files (non-Adilo): the HTML5 player's "ended" is a genuine completion,
  // recorded with the same progress upsert the website uses, then the next lesson is offered.
  const fileEndedFor = useRef<string | null>(null);
  const onFileVideoEvent = useCallback(
    async (e: { eventName: string }) => {
      if (e.eventName !== 'ended' || !lesson || fileEndedFor.current === lesson.id) return;
      const id = lesson.id;
      fileEndedFor.current = id;
      if (uid && enrolled && course.data) {
        try {
          await setLessonComplete(uid, course.data.id, id, true);
          setLocalDone((st) => new Set(st).add(id));
          qc.invalidateQueries({ queryKey: ['progress'] });
        } catch (err) {
          showToast(friendlyMessage(err, 'Could not save progress.'));
        }
      }
      onLessonEnded(id);
    },
    [lesson, uid, enrolled, course.data, qc, showToast, onLessonEnded]
  );

  const toggleComplete = async () => {
    if (!uid || !lesson || !course.data) return;
    if (isAdilo(lesson)) {
      showToast('Video lessons complete automatically after you watch 90% of the video.');
      return;
    }
    const done = !completed.has(lesson.id);
    setMarking(true);
    try {
      await setLessonComplete(uid, course.data.id, lesson.id, done);
      setLocalDone((s) => {
        const n = new Set(s);
        if (done) n.add(lesson.id);
        else n.delete(lesson.id);
        return n;
      });
      await qc.invalidateQueries({ queryKey: ['progress'] });
      if (done && next) showToast('Marked complete');
    } catch (e: any) {
      showToast(friendlyMessage(e, 'Could not update progress.'));
    } finally {
      setMarking(false);
    }
  };

  if (course.isLoading) return <View style={styles.dark}><Loading /></View>;
  if (!course.data) return <View style={styles.dark}><ErrorState message="Course not available." onRetry={() => course.refetch()} /></View>;
  const c = course.data;
  const total = lessons.length;
  const doneCount = lessons.filter((l) => completed.has(l.id)).length;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;

  /* ---------------------------------------------------------------- media area */
  let media: React.ReactNode;
  if (!lesson) {
    media = <View style={styles.mediaBox}><ActivityIndicator color={colors.white} /></View>;
  } else if (!openable) {
    media = (
      <LinearGradient colors={gradients.brandDeep} style={styles.mediaBox}>
        <Ionicons name="lock-closed" size={34} color={colors.white} />
        <Text style={styles.mediaTitle}>Enroll to unlock this lesson</Text>
        <Button title="View enrollment options" size="sm" variant="secondary" onPress={() => router.replace(`/course/${c.id}`)} />
      </LinearGradient>
    );
  } else if (lesson.type === 'quiz') {
    media = (
      <LinearGradient colors={['#2E1065', colors.accent]} style={styles.mediaBox}>
        <Ionicons name="help-circle" size={40} color={colors.white} />
        <Text style={styles.mediaTitle}>Module quiz</Text>
        <Text style={styles.mediaBody}>Quizzes are taken on the Edufy website for now.</Text>
        {!!config.webUrl && (
          <Button title="Open quiz on the web" size="sm" variant="secondary" onPress={() => WebBrowser.openBrowserAsync(`${config.webUrl}/learn/${c.id}/quiz/${lesson.quizId || ''}`)} />
        )}
      </LinearGradient>
    );
  } else if (lesson.type === 'article') {
    media = (
      <LinearGradient colors={gradients.brand} style={styles.mediaBox}>
        <Ionicons name="document-text" size={38} color={colors.white} />
        <Text style={styles.mediaTitle}>Reading lesson</Text>
        <Text style={styles.mediaBody}>{formatMinutes(lesson.durationMinutes)} read · scroll down</Text>
      </LinearGradient>
    );
  } else if (isAdilo(lesson)) {
    const src = adiloSrc;
    media = src ? (
      <VideoPlayer key={lesson.id} video={src} title={lesson.title} onEvent={onPlayerEvent} />
    ) : video.isLoading ? (
      <View style={styles.mediaBox}><ActivityIndicator color={colors.white} /><Text style={styles.mediaBody}>Loading video…</Text></View>
    ) : (
      <View style={styles.mediaBox}>
        <Ionicons name="alert-circle-outline" size={34} color="#FBBF24" />
        <Text style={styles.mediaTitle}>Video unavailable</Text>
        <Text style={styles.mediaBody}>{video.error ? friendlyMessage(video.error) : 'This lesson has no playable video link yet.'}</Text>
        {!!video.error && <Button title="Retry" size="sm" variant="secondary" onPress={() => video.refetch()} />}
      </View>
    );
  } else {
    const src = fileSrc;
    media = src ? (
      <VideoPlayer key={lesson.id} video={src} title={lesson.title} onEvent={src.kind === 'file' ? onFileVideoEvent : undefined} />
    ) : (
      <View style={styles.mediaBox}>
        <Ionicons name="videocam-off-outline" size={34} color="#CBD5E1" />
        <Text style={styles.mediaTitle}>No video for this lesson yet</Text>
      </View>
    );
  }

  const resumeAt = video.data?.progress && !completed.has(lesson?.id || '') ? video.data.progress.last_position_seconds : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <View style={{ backgroundColor: colors.black, paddingTop: insets.top }}>
        <View style={styles.topBar}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/learning'))} hitSlop={10} accessibilityLabel="Close player" accessibilityRole="button" style={styles.topBtn}>
            <Ionicons name="chevron-down" size={24} color={colors.white} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodySemi, color: colors.white, fontSize: 14 }} numberOfLines={1}>{c.title}</Text>
            {enrolled && <Text style={{ fontFamily: fonts.body, color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{percent}% complete · {doneCount}/{total} lessons</Text>}
          </View>
        </View>
        <View>
          {media}
          {afterEnd && afterEnd.forLesson === lessonId && (
            <NextLessonOverlay
              key={afterEnd.forLesson}
              decision={afterEnd.decision}
              thumbnail={c.thumbnail}
              autoplayEnabled={autoplayEnabled}
              onToggleAutoplay={setAutoplayEnabled}
              onDismiss={() => setAfterEnd(null)}
              onPlayNext={() => afterEnd.decision.kind === 'next' && setLessonId(afterEnd.decision.lesson.id)}
              onCourseComplete={() => router.push({ pathname: '/certificates', params: { claim: c.id } })}
            />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 18 }}>
        {lesson && (
          <View style={{ gap: 6 }}>
            <Text style={type.eyebrow}>Lesson {idx + 1} of {total}</Text>
            <Text style={type.h1}>{lesson.title}</Text>
            <Text style={type.small}>
              {lesson.type === 'video' ? 'Video' : lesson.type === 'article' ? 'Article' : 'Quiz'} · {formatMinutes(lesson.durationMinutes)}
              {completed.has(lesson.id) ? ' · Completed ✓' : ''}
            </Text>
            {resumeAt > 5 && isAdilo(lesson) && (
              <View style={styles.resume}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={[type.small, { color: colors.primaryDark, flex: 1 }]}>You stopped at {fmtClock(resumeAt)} — skip ahead in the player to continue.</Text>
              </View>
            )}
          </View>
        )}

        {/* Prev / complete / next */}
        {lesson && openable && (
          <View style={{ gap: 10 }}>
            {enrolled && lesson.type !== 'quiz' && (
              isAdilo(lesson) ? (
                <View style={styles.autoNote}>
                  <Ionicons name={completed.has(lesson.id) ? 'checkmark-circle' : 'information-circle-outline'} size={18} color={completed.has(lesson.id) ? colors.success : colors.muted} />
                  <Text style={[type.small, { flex: 1 }]}>
                    {completed.has(lesson.id) ? 'Completed. Your progress is saved to your account.' : 'Completes automatically when you’ve watched 90% of the video.'}
                  </Text>
                </View>
              ) : (
                <Button
                  title={completed.has(lesson.id) ? 'Completed — tap to undo' : 'Mark as complete'}
                  icon={completed.has(lesson.id) ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  variant={completed.has(lesson.id) ? 'secondary' : 'primary'}
                  size="md"
                  loading={marking}
                  onPress={toggleComplete}
                />
              )
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Previous" icon="chevron-back" variant="outline" size="md" disabled={!prev} onPress={() => prev && setLessonId(prev.id)} style={{ flex: 1 }} />
              <Button title="Next" icon="chevron-forward" variant={next ? 'secondary' : 'outline'} size="md" disabled={!next} onPress={() => next && setLessonId(next.id)} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {lesson?.type === 'article' && openable && (
          <View style={styles.article}>
            <Text style={[type.body, { fontSize: 16.5, lineHeight: 27 }]}>{lesson.contentText || 'This lesson has no content yet.'}</Text>
          </View>
        )}
        {lesson?.type === 'video' && openable && !!lesson.contentText && (
          <View style={styles.article}>
            <Text style={type.h3}>Lesson notes</Text>
            <Text style={[type.body, { marginTop: 8 }]}>{lesson.contentText}</Text>
          </View>
        )}

        {enrolled && (
          <View style={styles.progressCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={type.bodyStrong}>Course progress</Text>
              <Text style={[type.bodyStrong, { color: colors.primary }]}>{percent}%</Text>
            </View>
            <ProgressBar percent={percent} height={8} />
            <Text style={type.small}>{doneCount} of {total} lessons completed</Text>
            {isCourseComplete({ completed: doneCount, total }) && (
              <Button title="Get your certificate" icon="ribbon-outline" size="md" onPress={() => router.push({ pathname: '/certificates', params: { claim: c.id } })} />
            )}
          </View>
        )}
        {!enrolled && !enrolLoading && (
          <View style={styles.progressCard}>
            <Text style={type.bodyStrong}>You’re watching a free preview</Text>
            <Text style={type.small}>Enroll to unlock every lesson, track progress and earn a certificate.</Text>
            <Button title="Enroll now" size="md" onPress={() => router.replace(`/checkout/${c.id}`)} />
          </View>
        )}

        <View>
          <Text style={[type.h2, { marginBottom: 12 }]}>Course content</Text>
          <Curriculum sections={c.sections} activeLessonId={lessonId} completed={completed} canOpen={canOpen} onOpen={(l) => setLessonId(l.id)} initiallyOpen={0} />
        </View>
      </ScrollView>

      {!!toast && (
        <View style={[styles.toast, { bottom: insets.bottom + 20 }]} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={18} color={colors.white} />
          <Text style={{ fontFamily: fonts.bodySemi, color: colors.white, fontSize: 14, flex: 1 }}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  topBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  mediaBox: { width: '100%', aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, backgroundColor: '#0B1220' },
  mediaTitle: { fontFamily: fonts.displayBold, color: colors.white, fontSize: 18, textAlign: 'center' },
  mediaBody: { fontFamily: fonts.body, color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center' },
  resume: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, borderRadius: radius.sm, backgroundColor: colors.primarySoft, marginTop: 6 },
  autoNote: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  article: { padding: 18, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  progressCard: { gap: 10, padding: 18, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  toast: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.ink },
});
