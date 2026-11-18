import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { isSecureStoreSupported, prefs } from '@/lib/secureStorage';
import { missingConfig } from '@/lib/config';
import { pendingLink } from '@/lib/navigation';
import { prefetchCatalogue, prefetchEnrollments, qk } from '@/hooks/queries';
import { restoreQueryCache } from '@/lib/queryPersist';
import { Logo } from '@/components/Chrome';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { isHttps } from '@/logic/siteSettings';
import { colors, fonts } from '@/theme';

const MIN_SPLASH_MS = 1000; // the logo intro, without holding the student up
const MAX_SPLASH_MS = 8000; // never keep the splash up longer than this
const PREFETCH_BUDGET_MS = 2000;
const EXIT_MS = 320;

// Soft twinkling dots in the background (fixed layout, percentages of the screen)
const SPARKS = [
  { x: 0.12, y: 0.14, s: 4, d: 0 }, { x: 0.82, y: 0.1, s: 3, d: 400 }, { x: 0.68, y: 0.24, s: 5, d: 900 },
  { x: 0.2, y: 0.32, s: 3, d: 1300 }, { x: 0.9, y: 0.42, s: 4, d: 200 }, { x: 0.08, y: 0.55, s: 5, d: 700 },
  { x: 0.78, y: 0.66, s: 3, d: 1100 }, { x: 0.3, y: 0.74, s: 4, d: 500 }, { x: 0.6, y: 0.84, s: 3, d: 1500 },
  { x: 0.15, y: 0.88, s: 4, d: 300 }, { x: 0.88, y: 0.9, s: 5, d: 800 }, { x: 0.45, y: 0.06, s: 3, d: 1200 },
];
// Five stars above the emblem — echo the official logo
const STARS = [
  { a: -64, r: 104, size: 16 }, { a: -32, r: 112, size: 20 }, { a: 0, r: 116, size: 26 }, { a: 32, r: 112, size: 20 }, { a: 64, r: 104, size: 16 },
];
const WORDS = ['Learn.', 'Grow.', 'Achieve.'];

/**
 * Animated splash. While it shows: the Supabase session is restored from secure storage
 * (AuthContext), onboarding state is read, and the home screen's data is prefetched.
 * Routes: signed in → Home · signed out / expired session → Sign in (or onboarding first time).
 * The progress bar follows those real steps; animations respect the system "Reduce motion" setting.
 */
/** Any animated node that interpolates numbers (Animated.Value, Animated.modulo/add results, …). */
type NumericAnimatedNode = { interpolate(config: Animated.InterpolationConfig<number>): Animated.AnimatedInterpolation<number> };

export default function Entry() {
  const { session, initializing } = useAuth();
  const qc = useQueryClient();
  const { width, height } = useWindowDimensions();
  const [seenOnboarding, setSeen] = useState<boolean | null>(null);
  const [minDone, setMinDone] = useState(false);
  const [prefetched, setPrefetched] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [slow, setSlow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [go, setGo] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // Splash logo from Admin → Settings → Branding (cached on the phone); bundled logo if missing or unreachable
  const site = useSiteSettings();
  const splashRemote = [site.branding.splashLogo, site.branding.appLogo].find(isHttps);
  const [splashFailed, setSplashFailed] = useState<string | null>(null);

  const intro = useRef(new Animated.Value(0)).current; // emblem pop
  const brand = useRef(new Animated.Value(0)).current; // name + tagline
  const words = useRef(WORDS.map(() => new Animated.Value(0))).current;
  const stars = useRef(STARS.map(() => new Animated.Value(0))).current;
  const spin = useRef(new Animated.Value(0)).current; // orbit ring
  const ripple = useRef(new Animated.Value(0)).current; // expanding waves
  const drift = useRef(new Animated.Value(0)).current; // background blobs
  const twinkle = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const halfTurn = useRef(new Animated.Value(0.5)).current; // phase offset for the second wave

  useEffect(() => {
    // Our JS splash uses the same brand colour as the native splash, so the hand-off is seamless
    SplashScreen.hideAsync().catch(() => undefined);
    prefs.get('onboarding_done').then((v) => setSeen(v === '1')).catch(() => setSeen(false));
    let reduce = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reduce = v;
        setReduceMotion(v);
      })
      .catch(() => undefined);

    const ease = Easing.out(Easing.cubic);
    Animated.sequence([
      Animated.spring(intro, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 10 }),
      Animated.stagger(70, stars.map((v) => Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }))),
      Animated.timing(brand, { toValue: 1, duration: 420, easing: ease, useNativeDriver: true }),
      Animated.stagger(180, words.map((v) => Animated.timing(v, { toValue: 1, duration: 360, easing: ease, useNativeDriver: true }))),
    ]).start();

    const loops = [
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(ripple, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(drift, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(drift, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(twinkle, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(twinkle, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ),
      Animated.loop(Animated.timing(shine, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })),
    ];
    // Decorative loops start after the motion setting is known (skipped with Reduce motion)
    const startLoops = setTimeout(() => {
      if (!reduce) loops.forEach((l) => l.start());
    }, 50);

    const t1 = setTimeout(() => setMinDone(true), MIN_SPLASH_MS);
    const t2 = setTimeout(() => setSlow(true), 4500);
    const t3 = setTimeout(() => setTimedOut(true), MAX_SPLASH_MS);
    return () => {
      loops.forEach((l) => l.stop());
      clearTimeout(startLoops);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [intro, brand, words, stars, spin, ripple, drift, twinkle, shine]);

  // Warm the home screen's data (bounded — never delays start-up beyond the budget). Runs as soon as the
  // stored session is known, in parallel with the profile. Data saved on the phone from the last visit is
  // shown at once and refreshed in the background, so a returning student does not wait for the network.
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const budget = new Promise((r) => setTimeout(r, PREFETCH_BUDGET_MS));
    const work = restoreQueryCache(qc).then(() => {
      const warm = Promise.allSettled([prefetchCatalogue(qc), prefetchEnrollments(qc, uid)]);
      return qc.getQueryData(qk.courses) ? undefined : warm;
    });
    Promise.race([work, budget]).finally(() => {
      if (alive) setPrefetched(true);
    });
    return () => {
      alive = false;
    };
  }, [uid, qc]);

  const authReady = !initializing || timedOut;
  const dataReady = !session || prefetched || timedOut;
  const ready = authReady && seenOnboarding !== null && dataReady && (minDone || timedOut);

  // Real start-up steps drive the progress bar: session → account → your courses
  const step = !authReady ? 0 : seenOnboarding === null ? 1 : !dataReady ? 2 : 3;
  useEffect(() => {
    Animated.timing(progress, { toValue: [0.28, 0.55, 0.8, 1][step], duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [step, progress]);
  const status = slow ? 'Still connecting — hang on a moment…' : ['Restoring your session…', 'Setting up your account…', 'Loading your courses…', 'Ready!'][step];

  // Gentle exit (fade + slight zoom) before leaving the splash
  useEffect(() => {
    if (!ready || leaving) return;
    setLeaving(true);
    Animated.timing(exit, { toValue: 0, duration: EXIT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setGo(true));
  }, [ready, leaving, exit]);

  // Let a notification that opened the app navigate once the first screen is mounted
  // (no cleanup on purpose: this screen unmounts as soon as it redirects)
  useEffect(() => {
    if (go) setTimeout(() => pendingLink.markReady(), 300);
  }, [go]);

  // The student app keeps the session in the device keychain/keystore, which browsers don't have.
  if (!isSecureStoreSupported) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, padding: 28 }]}>
        <Logo size={48} subtitle={false} />
        <Text style={styles.msgTitle}>Open Edufy on your phone</Text>
        <Text style={styles.msgBody}>
          This is the Android / iOS student app. Run it in Expo Go or a development build on a phone or emulator.
          On a computer, use the Edufy Academy website instead.
        </Text>
      </View>
    );
  }

  if (missingConfig.length) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, padding: 28 }]}>
        <Text style={styles.msgTitle}>App configuration needs attention</Text>
        {missingConfig.map((m) => (
          <Text key={m} style={styles.msgBody}>• {m}</Text>
        ))}
        <Text style={[styles.msgBody, { color: colors.ink }]}>Edit app/.env, then restart with: npx expo start --clear</Text>
      </View>
    );
  }

  if (go) {
    const href = session ? '/(tabs)' : seenOnboarding ? '/(auth)/login' : '/onboarding';
    return <Redirect href={href as any} />;
  }

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateBack = spin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const wave = (offset: Animated.Value | null) => {
    // Animated.Value and Animated.modulo() nodes declare interpolate() with different generic constraints,
    // so their union is not callable; both satisfy this numeric interpolation signature.
    const v: NumericAnimatedNode = offset ? Animated.modulo(Animated.add(ripple, offset), 1) : ripple;
    return {
      opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
    };
  };
  const blob = (dx: number, dy: number) => ({
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
    ],
  });
  const BAR = 180;

  return (
    <LinearGradient colors={['#004AAD', '#003B8B', '#4A1BC4']} locations={[0, 0.5, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
      {/* Aurora blobs + twinkling sparks (decorative) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[styles.blob, { width: width * 0.9, height: width * 0.9, left: -width * 0.35, top: -width * 0.25, backgroundColor: 'rgba(82,113,255,0.35)' }, blob(40, 30)]} />
        <Animated.View style={[styles.blob, { width: width * 0.8, height: width * 0.8, right: -width * 0.3, bottom: -width * 0.2, backgroundColor: 'rgba(94,23,235,0.38)' }, blob(-36, -24)]} />
        {SPARKS.map((p, i) => (
          <Animated.View
            key={i}
            style={[
              styles.spark,
              {
                width: p.s, height: p.s, borderRadius: p.s, left: p.x * width, top: p.y * height,
                opacity: reduceMotion ? 0.5 : twinkle.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [0.2, 0.9] : [0.9, 0.2] }),
              },
            ]}
          />
        ))}
      </View>

      <Animated.View style={[styles.center, { opacity: exit, transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] }) }] }]}>
        <View style={styles.stage}>
          {/* expanding waves */}
          <Animated.View style={[styles.wave, wave(null)]} />
          <Animated.View style={[styles.wave, wave(halfTurn)]} />
          {/* orbit ring with a travelling dot */}
          <Animated.View style={[styles.orbit, { transform: [{ rotate }] }]}>
            <View style={styles.orbitDot} />
          </Animated.View>
          <Animated.View style={[styles.orbitInner, { transform: [{ rotate: rotateBack }] }]}>
            <View style={[styles.orbitDot, styles.orbitDotSmall]} />
          </Animated.View>
          {/* five stars */}
          {STARS.map((st, i) => {
            const rad = (st.a * Math.PI) / 180;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.star,
                  {
                    transform: [
                      { translateX: Math.sin(rad) * st.r },
                      { translateY: -Math.cos(rad) * st.r },
                      { scale: stars[i] },
                      { rotate: stars[i].interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) },
                    ],
                    opacity: stars[i],
                  },
                ]}
              >
                <Ionicons name="star" size={st.size} color="#FFB020" />
              </Animated.View>
            );
          })}
          {/* emblem */}
          <Animated.View
            style={[
              styles.logoTile,
              { opacity: intro, transform: [{ scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }, { rotate: intro.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) }] },
            ]}
          >
            <Image
              source={splashRemote && splashFailed !== splashRemote ? { uri: splashRemote } : require('../../assets/images/logo.png')}
              onError={() => splashRemote && setSplashFailed(splashRemote)}
              style={{ width: 112, height: 112 }}
              contentFit="contain"
              accessibilityLabel={site.general.appName || 'Edufy Academy'}
            />
          </Animated.View>
        </View>

        <Animated.Text style={[styles.brand, { opacity: brand, transform: [{ translateY: brand.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
          {site.general.appName && site.general.appName !== 'Edufy Academy' ? site.general.appName : <>Edufy <Text style={{ color: '#A5B8FF' }}>Academy</Text></>}
        </Animated.Text>
        <View style={styles.words} accessible accessibilityLabel="Learn. Grow. Achieve.">
          {WORDS.map((w, i) => (
            <Animated.Text
              key={w}
              style={[
                styles.word,
                i === WORDS.length - 1 && { color: '#FFD27A' },
                { opacity: words[i], transform: [{ translateY: words[i].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
              ]}
            >
              {w}
            </Animated.Text>
          ))}
        </View>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: exit }]} accessibilityRole="progressbar" accessibilityLabel={status}>
        <View style={[styles.track, { width: BAR }]}>
          <Animated.View
            style={[
              styles.fill,
              { width: BAR, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-BAR, 0] }) }] },
            ]}
          >
            <LinearGradient colors={['#A5B8FF', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            {!reduceMotion && (
              <Animated.View style={[styles.shine, { transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-40, BAR] }) }] }]} />
            )}
          </Animated.View>
        </View>
        <Text style={styles.footerText}>{status}</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  blob: { position: 'absolute', borderRadius: 9999 },
  spark: { position: 'absolute', backgroundColor: '#FFFFFF' },
  stage: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' },
  orbit: {
    position: 'absolute', width: 196, height: 196, borderRadius: 98, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', borderStyle: 'dashed',
    alignItems: 'center',
  },
  orbitInner: { position: 'absolute', width: 168, height: 168, borderRadius: 84, alignItems: 'center' },
  orbitDot: { width: 12, height: 12, borderRadius: 6, marginTop: -6, backgroundColor: '#FFD27A', shadowColor: '#FFD27A', shadowOpacity: 0.9, shadowRadius: 8, elevation: 4 },
  orbitDotSmall: { width: 8, height: 8, borderRadius: 4, marginTop: -4, backgroundColor: '#A5B8FF' },
  star: { position: 'absolute' },
  // White plate behind the official emblem (its blue ring needs contrast on the brand-blue background);
  // matches the native splash image so the hand-off is seamless
  logoTile: {
    width: 136, height: 136, borderRadius: 68, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0B1220', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
  brand: { marginTop: 4, fontFamily: fonts.display, fontSize: 32, letterSpacing: -0.6, color: colors.white },
  words: { flexDirection: 'row', gap: 10, marginTop: 10 },
  word: { fontFamily: fonts.bodySemi, fontSize: 15, letterSpacing: 2, color: 'rgba(255,255,255,0.88)', textTransform: 'uppercase' },
  footer: { position: 'absolute', bottom: 60, alignItems: 'center', gap: 12 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, overflow: 'hidden' },
  shine: { position: 'absolute', top: 0, bottom: 0, width: 40, backgroundColor: 'rgba(255,255,255,0.65)' },
  footerText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: 'rgba(255,255,255,0.78)' },
  msgTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: 'center', marginTop: 24 },
  msgBody: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 10, maxWidth: 420 },
});
