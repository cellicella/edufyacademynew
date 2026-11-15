import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { resolveVideo } from '../../utils/videoEmbed';

interface Props {
  /** Embed code, Adilo/YouTube/Vimeo link, or direct video file URL */
  source: string | null | undefined;
  title: string;
  autoPlay?: boolean;
  className?: string;
}

/** Responsive 16:9 player with fullscreen support. Never renders HTML from the source. */
export const ResponsiveVideo: React.FC<Props> = ({ source, title, autoPlay, className = '' }) => {
  const video = resolveVideo(source);
  return (
    <div className={`relative w-full aspect-video bg-black overflow-hidden ${className}`}>
      {!video ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white">
          <AlertTriangle className="w-7 h-7 text-amber-400" />
          <p className="text-[14px] text-slate-300">This video link isn’t supported. Use an Adilo embed code or link, a YouTube/Vimeo link, or an MP4 file.</p>
        </div>
      ) : video.kind === 'iframe' ? (
        <iframe
          src={video.src}
          title={title}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <video src={video.src} title={title} controls autoPlay={autoPlay} playsInline className="absolute inset-0 w-full h-full object-contain" />
      )}
    </div>
  );
};
