import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, History, Loader2 } from 'lucide-react';
import { adiloService, LessonVideoAccess } from '../../services/api';

/** Origin used by the Adilo player for postMessage events (per Adilo API docs). */
const ADILO_ORIGIN = 'https://adilo.bigcommand.com';
const SAVE_INTERVAL_MS = 15000;

const fmt = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

interface Props {
  lessonId: string;
  title: string;
  /** Called when the server confirms the lesson is complete (verified watch time). */
  onCompleted?: () => void;
}

/**
 * Adilo player embed with verified progress tracking.
 * Events handled (Adilo docs): ready, currentTime, play, paused, ended,
 * playbackSpeedChange, resolutionChange, subtitleChange.
 */
export const AdiloPlayer: React.FC<Props> = ({ lessonId, title, onCompleted }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [access, setAccess] = useState<LessonVideoAccess | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(null);
  const [meta, setMeta] = useState<{ rate?: number; resolution?: string; subtitle?: string }>({});

  // Watch-time accounting (only forward progress observed from player events counts)
  const state = useRef({ position: 0, lastTick: null as number | null, watched: 0, duration: 0, playing: false, lastSaved: 0, dirty: false });

  useEffect(() => {
    let alive = true;
    setAccess(null);
    setLoadError(null);
    setReady(false);
    setCompleted(false);
    setResumeAt(null);
    setMeta({});
    state.current = { position: 0, lastTick: null, watched: 0, duration: 0, playing: false, lastSaved: 0, dirty: false };

    adiloService
      .getLessonVideo(lessonId)
      .then((a) => {
        if (!alive) return;
        setAccess(a);
        if (a.durationSeconds) state.current.duration = a.durationSeconds;
        if (a.progress) {
          state.current.watched = a.progress.watched_seconds || 0;
          setCompleted(!!a.progress.is_completed);
          if (a.progress.last_position_seconds > 5) setResumeAt(a.progress.last_position_seconds);
        }
      })
      .catch((e) => alive && setLoadError(e.message || 'This video could not be loaded.'));
    return () => {
      alive = false;
    };
  }, [lessonId]);

  const save = useCallback(
    async (event: string, keepalive = false) => {
      const s = state.current;
      if (!s.dirty && event === 'currentTime') return;
      s.dirty = false;
      s.lastSaved = Date.now();
      try {
        const r = await adiloService.reportProgress(
          lessonId,
          { position: Math.round(s.position), watchedSeconds: Math.round(s.watched), duration: Math.round(s.duration), event },
          keepalive
        );
        if (r.justCompleted || (r.isCompleted && !completed)) {
          setCompleted(true);
          onCompleted?.();
        }
      } catch {
        s.dirty = true; // retry on next save
      }
    },
    [lessonId, completed, onCompleted]
  );

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Accept messages only from the Adilo player iframe we rendered
      if (e.origin !== ADILO_ORIGIN) return;
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;

      let data: any = e.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data.eventName !== 'string') return;

      const s = state.current;
      const mediaDuration = Number(data.media?.duration);
      if (Number.isFinite(mediaDuration) && mediaDuration > 0 && mediaDuration < 86400) s.duration = mediaDuration;

      switch (data.eventName) {
        case 'ready':
          setReady(true);
          break;
        case 'play':
          s.playing = true;
          s.lastTick = null;
          break;
        case 'currentTime': {
          const t = Number(data.timestamp);
          if (!Number.isFinite(t) || t < 0) break;
          if (s.lastTick !== null) {
            const delta = t - s.lastTick;
            // Count natural forward playback only (ignores seeks / scrubbing)
            if (delta > 0 && delta <= 5) {
              s.watched += delta;
              s.dirty = true;
            }
          }
          s.lastTick = t;
          s.position = t;
          s.playing = true;
          if (Date.now() - s.lastSaved > SAVE_INTERVAL_MS) save('currentTime');
          break;
        }
        case 'paused': {
          const t = Number(data.currentPlayerTimestamp);
          if (Number.isFinite(t) && t >= 0) s.position = t;
          s.playing = false;
          s.lastTick = null;
          s.dirty = true;
          save('paused');
          break;
        }
        case 'ended':
          s.playing = false;
          s.lastTick = null;
          s.dirty = true;
          save('ended');
          setResumeAt(null);
          break;
        case 'playbackSpeedChange':
          if (Number.isFinite(Number(data.rate))) setMeta((m) => ({ ...m, rate: Number(data.rate) }));
          break;
        case 'resolutionChange':
          if (typeof data.resolution === 'string') setMeta((m) => ({ ...m, resolution: data.resolution }));
          break;
        case 'subtitleChange':
          setMeta((m) => ({ ...m, subtitle: data.activeTrack?.mode === 'showing' ? data.activeTrack?.label || 'On' : 'Off' }));
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [save]);

  // Save on tab hide / unmount
  useEffect(() => {
    const flush = () => {
      if (state.current.dirty) save('paused', true);
    };
    const onVis = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [save]);

  if (loadError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div className="max-w-md text-center text-white space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <div className="font-display text-xl font-bold">Video unavailable</div>
          <p className="text-sm text-slate-300">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!access) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-white gap-2">
        <Loader2 className="w-6 h-6 animate-spin" /> <span className="text-sm">Loading video…</span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Responsive 16:9 frame: fills the player area, never a fixed pixel size */}
      <div className="relative h-full max-w-full aspect-video">
        <iframe
          ref={iframeRef}
          src={access.embedUrl}
          title={title}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      {!ready && (
        <div className="pointer-events-none absolute top-3 left-3 inline-flex items-center gap-2 h-8 px-3 rounded-full bg-black/60 text-white text-[13px]">
          <Loader2 className="w-4 h-4 animate-spin" /> Preparing player…
        </div>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
        {resumeAt !== null && !completed && (
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-black/70 text-white text-[13px]">
            <History className="w-4 h-4" /> You stopped at {fmt(resumeAt)} — skip ahead in the player to continue
          </span>
        )}
        {completed && (
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-emerald-600/90 text-white text-[13px]">
            <CheckCircle2 className="w-4 h-4" /> Lesson complete
          </span>
        )}
        {meta.rate && meta.rate !== 1 && <span className="h-8 px-3 inline-flex items-center rounded-full bg-black/60 text-white text-[13px]">{meta.rate}x</span>}
      </div>
    </div>
  );
};
