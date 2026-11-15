import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { config } from '@/lib/config';
import { ADILO_ORIGIN, ResolvedVideo, escapeAttr } from '@/utils/video';
import { colors, fonts } from '@/theme';

export interface PlayerEvent {
  eventName: string;
  [k: string]: any;
}

const SLOW_MS = 20000;

/**
 * Responsive 16:9 player. Embedded players (Adilo / YouTube / Vimeo) run inside a small HTML page
 * so the Adilo player's postMessage events (ready, play, currentTime, paused, ended …) can be
 * forwarded to React Native — the same events the website's AdiloPlayer listens to.
 * Only the validated player URL is used; no HTML from the database is ever rendered.
 */
export const VideoPlayer: React.FC<{ video: ResolvedVideo; title: string; onEvent?: (e: PlayerEvent) => void; autoPlay?: boolean }> = ({
  video, title, onEvent, autoPlay,
}) => {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const readyRef = useRef(false);
  const isAdilo = video.src.startsWith(`${ADILO_ORIGIN}/`);
  const baseUrl = config.webUrl || 'https://localhost';

  // If the Adilo player never reports "ready" (blocked domain, poor network) offer a reload
  useEffect(() => {
    readyRef.current = false;
    setSlow(false);
    if (!isAdilo) return;
    const t = setTimeout(() => !readyRef.current && setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [video.src, attempt, isAdilo]);

  const html = useMemo(() => {
    const src = escapeAttr(video.src);
    const media =
      video.kind === 'iframe'
        ? `<iframe id="p" src="${src}" title="${escapeAttr(title)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen webkitallowfullscreen mozallowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
        : `<video id="p" src="${src}" controls playsinline ${autoPlay ? 'autoplay' : ''} controlsList="nodownload"></video>`;
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}iframe,video{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}</style></head>
<body>${media}
<script>
(function(){
  var send=function(o){try{window.ReactNativeWebView.postMessage(JSON.stringify(o))}catch(e){}};
  window.addEventListener('message',function(e){
    if(e.origin!=='${ADILO_ORIGIN}')return;
    var d=e.data; if(typeof d==='string'){try{d=JSON.parse(d)}catch(_){return}}
    if(d&&typeof d.eventName==='string')send(d);
  });
  var v=document.querySelector('video');
  if(v){
    v.addEventListener('play',function(){send({eventName:'play'})});
    v.addEventListener('timeupdate',function(){send({eventName:'currentTime',timestamp:v.currentTime,media:{duration:v.duration}})});
    v.addEventListener('pause',function(){send({eventName:'paused',currentPlayerTimestamp:v.currentTime})});
    v.addEventListener('ended',function(){send({eventName:'ended'})});
    v.addEventListener('loadedmetadata',function(){send({eventName:'ready',media:{duration:v.duration}})});
    v.addEventListener('error',function(){send({eventName:'error'})});
  }
})();
</script></body></html>`;
  }, [video, title, autoPlay]);

  const reload = () => {
    setFailed(null);
    setLoading(true);
    setAttempt((a) => a + 1);
  };

  return (
    <View style={styles.frame}>
      {failed ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={32} color="#FBBF24" />
          <Text style={styles.msg}>{failed}</Text>
          <Pressable onPress={reload} style={styles.reload} accessibilityRole="button">
            <Ionicons name="refresh" size={16} color={colors.white} />
            <Text style={styles.reloadText}>Reload video</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={`${video.src}#${attempt}`}
          source={{ html, baseUrl }}
          originWhitelist={['*']}
          style={styles.web}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={!autoPlay}
          setSupportMultipleWindows={false}
          onMessage={(e) => {
            try {
              const data = JSON.parse(e.nativeEvent.data);
              if (!data || typeof data.eventName !== 'string') return;
              if (data.eventName === 'ready' || data.eventName === 'play' || data.eventName === 'currentTime') {
                readyRef.current = true;
                if (slow) setSlow(false);
              }
              if (data.eventName === 'error') setFailed('This video file could not be played.');
              onEvent?.(data);
            } catch {
              /* not a player message */
            }
          }}
          onLoadEnd={() => setLoading(false)}
          onError={(e) => setFailed(/internet|network|host/i.test(e.nativeEvent?.description || '') ? 'No internet connection. Check your network and reload.' : 'This video could not be loaded.')}
          onHttpError={(e) => e.nativeEvent.statusCode >= 400 && setFailed(`The video page returned an error (${e.nativeEvent.statusCode}).`)}
          onRenderProcessGone={() => setFailed('The video player stopped unexpectedly.')}
          onContentProcessDidTerminate={() => setFailed('The video player stopped unexpectedly.')}
          // Keep the player in place: block top-level navigation away from the player page and
          // open any link the player tries to follow (e.g. "Watch on Adilo") in the browser.
          onShouldStartLoadWithRequest={(req) => {
            if (req.isTopFrame === false || req.url.startsWith('about:') || req.url.startsWith('data:') || req.url.startsWith(baseUrl)) return true;
            if (/^https?:/i.test(req.url)) Linking.openURL(req.url).catch(() => undefined);
            return false;
          }}
          accessibilityLabel={`Video player: ${title}`}
        />
      )}
      {loading && !failed && (
        <View style={[styles.center, StyleSheet.absoluteFill]} pointerEvents="none">
          <ActivityIndicator color={colors.white} />
        </View>
      )}
      {slow && !failed && (
        <Pressable onPress={reload} style={styles.slow} accessibilityRole="button">
          <Ionicons name="refresh" size={14} color={colors.white} />
          <Text style={styles.reloadText}>Taking a while? Tap to reload</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  frame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.black, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  msg: { fontFamily: fonts.body, color: '#CBD5E1', textAlign: 'center', fontSize: 14 },
  reload: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.16)' },
  reloadText: { fontFamily: fonts.bodySemi, color: colors.white, fontSize: 13 },
  slow: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.65)' },
});
