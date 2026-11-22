import React, { useEffect, useRef, useState } from 'react';
import { Play, X } from 'lucide-react';

interface Props {
  title: string;
  /** e.g. "Video lesson", "Quiz" */
  kind: string;
  seconds: number;
  onPlayNow: () => void;
  onCancel: () => void;
}

/** "Up next" card shown over the finished video: counts down, then opens the next lesson. */
export const UpNextOverlay: React.FC<Props> = ({ title, kind, seconds, onPlayNow, onCancel }) => {
  const [left, setLeft] = useState(seconds);
  const done = useRef(false);
  const playNow = useRef(onPlayNow);
  playNow.current = onPlayNow;

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (remaining === 0 && !done.current) {
        done.current = true;
        window.clearInterval(id);
        playNow.current();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [seconds]);

  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-4" role="dialog" aria-label="Up next">
      <div className="w-full max-w-sm rounded-2xl bg-[#111827]/95 border border-white/10 p-5 text-white shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 shrink-0" aria-hidden="true">
            <svg viewBox="0 0 52 52" className="w-14 h-14 -rotate-90">
              <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
              <circle cx="26" cy="26" r={r} fill="none" stroke="#5271FF" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (left / seconds)} style={{ transition: 'stroke-dashoffset 250ms linear' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold tabular-nums">{left}</span>
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-blue-300">Up next · {kind}</div>
            <div className="font-display text-[15px] font-bold leading-snug line-clamp-2">{title}</div>
            <div className="text-[13px] text-slate-300 mt-0.5" aria-live="polite">Starting in {left} s</div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onPlayNow} className="flex-1 h-10 rounded-full bg-[#004AAD] hover:bg-[#003B8B] text-sm font-bold inline-flex items-center justify-center gap-1.5">
            <Play className="w-4 h-4 fill-current" /> Play now
          </button>
          <button type="button" onClick={onCancel} className="h-10 px-4 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold inline-flex items-center justify-center gap-1.5">
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
