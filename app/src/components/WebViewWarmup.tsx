import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

// Long enough for Home to finish its first render and data loading (React Native 0.88 has no InteractionManager)
const DELAY_MS = 3000;

/**
 * Android loads its WebView engine (Chromium) the first time a WebView is created, which adds a noticeable
 * pause before the first lesson video can start. This creates one invisible, empty WebView shortly after the
 * home screen is idle and removes it as soon as it has loaded: the engine then stays loaded for the session,
 * so the video player opens without that delay. Nothing is downloaded.
 */
export const WebViewWarmup: React.FC = () => {
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const t = setTimeout(() => setShow(true), DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  if (!show || done) return null;
  return (
    <View style={styles.hidden} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <WebView
        source={{ html: '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body></body></html>' }}
        style={styles.hidden}
        javaScriptEnabled={false}
        onLoadEnd={() => setDone(true)}
        onError={() => setDone(true)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
});
