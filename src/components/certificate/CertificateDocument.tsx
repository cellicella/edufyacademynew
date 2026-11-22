import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Certificate } from '../../types';
import { qrMatrix, qrSvgPath } from '../../lib/qr';
import {
  CERT_BRAND as B,
  CERT_SIZE,
  fitFontSize,
  formatCertificateDate,
  formatCourseHours,
  verificationUrl,
} from '../../lib/certificate';

/** Official logo asset (unchanged file from /public/brand). */
const LOGO_SRC = '/brand/edufy-logo-512.png';

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&display=swap';

/** Loads the certificate typefaces once (only on pages that show a certificate). */
export function useCertificateFonts(): void {
  useLayoutEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('edufy-cert-fonts')) return;
    const link = document.createElement('link');
    link.id = 'edufy-cert-fonts';
    link.rel = 'stylesheet';
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}

const SERIF = "'Cormorant Garamond', 'Times New Roman', Georgia, serif";
const CAPS = "'Cinzel', 'Times New Roman', Georgia, serif";
const SANS = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";

/** Number of lines `text` wraps to at `maxWidth` with the given CSS font (canvas measurement). */
function countLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let lines = 1;
  let line = 0;
  const space = ctx.measureText(' ').width;
  for (const word of words) {
    const w = ctx.measureText(word).width;
    if (w > maxWidth) {
      // An unbreakable word wraps anywhere (overflow-wrap: anywhere)
      if (line > 0) lines += 1;
      lines += Math.ceil(w / maxWidth) - 1;
      line = w % maxWidth;
      continue;
    }
    const next = line === 0 ? w : line + space + w;
    if (next <= maxWidth) line = next;
    else {
      lines += 1;
      line = w;
    }
  }
  return lines;
}

/**
 * Font size at which a text fits its box width and line limit, measured with the real font once it
 * has loaded (works while the sheet is hidden, e.g. the print copy). Long names and titles never overlap.
 */
function useFittedSize(
  text: string,
  opts: { max: number; min: number; width: number; lines: number; avgCharEm: number; font: string },
): number {
  const { max, min, width, lines, avgCharEm, font } = opts;
  const [size, setSize] = useState(() => fitFontSize(text, { max, min, width, lines, avgCharEm }));

  useLayoutEffect(() => {
    let cancelled = false;
    const fit = () => {
      if (cancelled || typeof document === 'undefined') return;
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return;
      const fits = (px: number) => {
        ctx.font = font.replace('{px}', String(px));
        return countLines(ctx, text, width * 0.98) <= lines;
      };
      let s = max;
      while (s > min && !fits(s)) s -= 1;
      setSize(s);
    };
    fit();
    if (document.fonts?.ready) document.fonts.ready.then(fit).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [text, max, min, width, lines, avgCharEm, font]);

  return size;
}

const QrCode: React.FC<{ value: string; size: number }> = ({ value, size }) => {
  const qr = useMemo(() => {
    try {
      return qrSvgPath(qrMatrix(value), 0);
    } catch {
      return null;
    }
  }, [value]);
  if (!qr) return null;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges" role="img" aria-label="QR code to verify this certificate">
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={qr.path} fill={B.ink} />
    </svg>
  );
};

/** Corner flourish: layered brand-gradient bands with a gold edge. Mirrored for the opposite corner. */
const CornerAccent: React.FC<{ flip?: boolean; uid: string }> = ({ flip, uid }) => {
  const gid = `${uid}-cg-${flip ? 'b' : 'a'}`;
  return (
  <svg
    width="300"
    height="300"
    viewBox="0 0 300 300"
    aria-hidden="true"
    style={{ position: 'absolute', ...(flip ? { right: 0, bottom: 0, transform: 'rotate(180deg)' } : { left: 0, top: 0 }) }}
  >
    <defs>
      <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={B.blue} />
        <stop offset="0.55" stopColor={B.blue2} />
        <stop offset="1" stopColor={B.purple} />
      </linearGradient>
    </defs>
    <path d="M0 0 H165 L0 165 Z" fill={`url(#${gid})`} opacity="0.95" />
    <path d="M0 0 H215 L0 215 Z" fill={`url(#${gid})`} opacity="0.08" />
    <path d="M165 0 L0 165" stroke={B.goldLight} strokeWidth="2.2" />
    <path d="M190 0 L0 190" stroke={B.gold} strokeWidth="0.9" opacity="0.8" />
  </svg>
  );
};

/** Gold seal with the official logo at its centre. */
const Seal: React.FC<{ uid: string }> = ({ uid }) => {
  const points = 36;
  const outer = 62;
  const inner = 56;
  const star = Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    return `${(70 + r * Math.cos(a)).toFixed(2)},${(70 + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  return (
    <div style={{ position: 'relative', width: 140, height: 140 }} aria-hidden="true">
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id={`${uid}-seal-gold`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#F6E3A8" />
            <stop offset="0.55" stopColor="#D6B25E" />
            <stop offset="1" stopColor="#A9822F" />
          </radialGradient>
          <path id={`${uid}-seal-text`} d="M70,70 m-41,0 a41,41 0 1,1 82,0 a41,41 0 1,1 -82,0" />
        </defs>
        <polygon points={star} fill={`url(#${uid}-seal-gold)`} />
        <circle cx="70" cy="70" r="51" fill="none" stroke="#FFF7DD" strokeWidth="1.2" opacity="0.9" />
        <circle cx="70" cy="70" r="49" fill="#FFFDF7" />
        <circle cx="70" cy="70" r="46" fill="none" stroke={B.gold} strokeWidth="0.8" />
        <text fill={B.gold} style={{ fontFamily: CAPS, fontSize: 8.6, letterSpacing: 2.2, fontWeight: 600 }}>
          <textPath href={`#${uid}-seal-text`} startOffset="0">EDUFY ACADEMY • COURSE COMPLETION •</textPath>
        </text>
      </svg>
      <img
        src={LOGO_SRC}
        alt=""
        style={{ position: 'absolute', left: 44, top: 44, width: 52, height: 52, objectFit: 'contain' }}
      />
    </div>
  );
};

export interface CertificateDocumentProps {
  certificate: Certificate;
  /** Site address used for the verification link and QR code */
  siteUrl: string;
}

/** The certificate sheet: 1123 × 794 px = A4 landscape at 96 dpi. Scale it with <CertificateFrame>. */
export const CertificateDocument: React.FC<CertificateDocumentProps> = ({ certificate: c, siteUrl }) => {
  useCertificateFonts();
  const uid = `c${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const verifyUrl = verificationUrl(siteUrl, c.certificateCode);
  const verifyLabel = verifyUrl.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
  const hours = formatCourseHours(c.courseHours);
  const nameSize = useFittedSize(c.studentName, { max: 60, min: 26, width: 861, lines: 1, avgCharEm: 0.48, font: `700 {px}px ${SERIF}` });
  const titleSize = useFittedSize(c.courseTitle, { max: 31, min: 18, width: 861, lines: 2, avgCharEm: 0.5, font: `700 {px}px ${SERIF}` });

  const details: Array<[string, string]> = [
    ['Certificate ID', c.certificateCode],
    ['Completion Date', formatCertificateDate(c.issueDate)],
    ['Instructor', c.instructorName],
    ...(hours ? ([['Course Duration', hours]] as Array<[string, string]>) : []),
  ];

  return (
    <div
      className="cert-sheet"
      style={{
        position: 'relative',
        width: CERT_SIZE.width,
        height: CERT_SIZE.height,
        overflow: 'hidden',
        background: `radial-gradient(ellipse at 50% 42%, #FFFFFF 0%, ${B.ivory} 58%, #FBF6EA 100%)`,
        color: B.ink,
        fontFamily: SANS,
        // Fixed metrics so the sheet looks the same inside any page's styles
        fontSize: 14,
        lineHeight: 1.35,
        letterSpacing: 'normal',
        textAlign: 'left',
        boxSizing: 'border-box',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Fine geometric lattice */}
      <svg aria-hidden="true" width={CERT_SIZE.width} height={CERT_SIZE.height} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <pattern id={`${uid}-lattice`} width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 14 H28 M14 0 V28" stroke={B.blue} strokeWidth="0.35" opacity="0.07" />
          </pattern>
          <linearGradient id={`${uid}-frame`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={B.blue} />
            <stop offset="0.5" stopColor={B.blue2} />
            <stop offset="1" stopColor={B.purple} />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${uid}-lattice)`} />
        {/* Guilloché rosette behind the name */}
        <g transform="translate(561 380)" opacity="0.07" fill="none" stroke={B.purple} strokeWidth="0.6">
          {Array.from({ length: 24 }, (_, i) => (
            <ellipse key={i} rx="230" ry="96" transform={`rotate(${i * 7.5})`} />
          ))}
        </g>
      </svg>

      <CornerAccent uid={uid} />
      <CornerAccent uid={uid} flip />

      {/* Logo watermark */}
      <img
        src={LOGO_SRC}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', left: 561 - 170, top: 400 - 170, width: 340, height: 340, objectFit: 'contain', opacity: 0.045 }}
      />

      {/* Double-line border: brand gradient outer line, gold inner line with corner diamonds */}
      <svg aria-hidden="true" width={CERT_SIZE.width} height={CERT_SIZE.height} style={{ position: 'absolute', inset: 0 }}>
        <rect x="26" y="26" width={CERT_SIZE.width - 52} height={CERT_SIZE.height - 52} fill="none" stroke={`url(#${uid}-frame)`} strokeWidth="3" />
        <rect x="36" y="36" width={CERT_SIZE.width - 72} height={CERT_SIZE.height - 72} fill="none" stroke={B.gold} strokeWidth="1.1" />
        {[
          [36, 36],
          [CERT_SIZE.width - 36, 36],
          [36, CERT_SIZE.height - 36],
          [CERT_SIZE.width - 36, CERT_SIZE.height - 36],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(45)`}>
            <rect x="-6" y="-6" width="12" height="12" fill={B.ivory} stroke={B.gold} strokeWidth="1.1" />
            <rect x="-2.5" y="-2.5" width="5" height="5" fill={B.gold} />
          </g>
        ))}
      </svg>

      {/* Header */}
      <div style={{ position: 'absolute', top: 54, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src={LOGO_SRC} alt="Edufy Academy" style={{ width: 80, height: 80, objectFit: 'contain' }} />
        <div style={{ marginTop: 6, fontFamily: SANS, fontWeight: 700, fontSize: 12.5, letterSpacing: '0.42em', color: B.blue, paddingLeft: '0.42em' }}>
          EDUFY ACADEMY
        </div>
        <div style={{ marginTop: 14, fontFamily: CAPS, fontWeight: 600, fontSize: 50, letterSpacing: '0.16em', lineHeight: 1, color: B.blue, paddingLeft: '0.16em' }}>
          CERTIFICATE
        </div>
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 92, height: 1.4, background: `linear-gradient(90deg, transparent, ${B.gold})` }} />
          <span style={{ fontFamily: CAPS, fontWeight: 600, fontSize: 17, letterSpacing: '0.42em', color: B.gold, paddingLeft: '0.42em' }}>
            OF COMPLETION
          </span>
          <span style={{ width: 92, height: 1.4, background: `linear-gradient(90deg, ${B.gold}, transparent)` }} />
        </div>
      </div>

      {/* Body */}
      <div style={{ position: 'absolute', top: 296, left: 131, width: 861, textAlign: 'center' }}>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 21, color: '#4A5268' }}>
          This certificate is proudly presented to
        </div>
        <div
          style={{
            marginTop: 6,
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: nameSize,
            lineHeight: 1.15,
            color: B.ink,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'clip',
          }}
        >
          {c.studentName}
        </div>
        <div style={{ margin: '6px auto 0', width: 520, height: 1.5, background: `linear-gradient(90deg, transparent, ${B.gold} 20%, ${B.goldLight} 50%, ${B.gold} 80%, transparent)` }} />
        <div style={{ marginTop: 12, fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 19, color: '#4A5268' }}>
          For successfully completing the course
        </div>
        <div
          style={{
            margin: '8px auto 0',
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: titleSize,
            lineHeight: 1.18,
            color: B.blue,
            maxHeight: Math.ceil(titleSize * 1.18 * 2) + 2,
            overflow: 'hidden',
            overflowWrap: 'anywhere',
          }}
        >
          {c.courseTitle}
        </div>
        <div style={{ marginTop: 8, fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: 19, color: '#4A5268' }}>
          At Edufy Academy.
        </div>
      </div>

      {/* Footer: details · seal · QR */}
      <div style={{ position: 'absolute', left: 84, right: 84, top: 590, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 360, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 14, rowGap: 6, fontSize: 12.5, alignContent: 'center' }}>
          {details.map(([label, value]) => (
            <React.Fragment key={label}>
              <div style={{ color: '#6B7280', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 10.5, paddingTop: 2 }}>{label}</div>
              <div
                style={{
                  color: B.ink,
                  fontWeight: 600,
                  fontFamily: label === 'Certificate ID' ? "'JetBrains Mono', ui-monospace, monospace" : SANS,
                  overflowWrap: 'anywhere',
                }}
              >
                {value}
              </div>
            </React.Fragment>
          ))}
        </div>

        <Seal uid={uid} />

        <div style={{ width: 360, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }}>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#4A5268', lineHeight: 1.45 }}>
            <div style={{ fontWeight: 700, color: B.blue, fontSize: 11.5, letterSpacing: '0.04em' }}>VERIFY THIS CERTIFICATE</div>
            <div>Scan the code or visit</div>
            <div style={{ fontWeight: 600, color: B.ink, overflowWrap: 'anywhere' }}>{verifyLabel}</div>
            <div>and enter the certificate ID</div>
          </div>
          <div style={{ padding: 6, background: '#fff', border: `1px solid ${B.goldLight}`, borderRadius: 6 }}>
            <QrCode value={verifyUrl} size={92} />
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 50, textAlign: 'center', fontFamily: SERIF, fontStyle: 'italic', fontSize: 14.5, color: '#5B6275' }}>
        This certificate verifies the successful completion of the above-mentioned course.
      </div>

      {c.revokedAt && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%) rotate(-18deg)',
            border: '6px solid rgba(220, 38, 38, 0.75)',
            color: 'rgba(220, 38, 38, 0.8)',
            fontFamily: CAPS,
            fontWeight: 700,
            fontSize: 88,
            letterSpacing: '0.12em',
            padding: '6px 34px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.55)',
          }}
        >
          REVOKED
        </div>
      )}
    </div>
  );
};

/** Scales the A4 sheet to the width of its container (keeps the 297:210 ratio). */
export const CertificateFrame: React.FC<CertificateDocumentProps & { className?: string }> = ({ className, ...props }) => {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / CERT_SIZE.width || 0.5);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className={className} style={{ position: 'relative', width: '100%', aspectRatio: `${CERT_SIZE.width} / ${CERT_SIZE.height}` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <CertificateDocument {...props} />
      </div>
    </div>
  );
};
