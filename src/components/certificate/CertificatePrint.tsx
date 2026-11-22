import React from 'react';
import { createPortal } from 'react-dom';
import { Certificate } from '../../types';
import { CertificateDocument } from './CertificateDocument';
import { certificateFileName } from '../../lib/certificate';

const PRINT_CLASS = 'edufy-printing-certificate';
const STYLE_ID = 'edufy-cert-print-style';

/**
 * Print stylesheet: while a certificate prints, only the certificate sheet is on the page,
 * at exactly A4 landscape (297 × 210 mm) with no margins, colours and backgrounds kept.
 */
const PRINT_CSS = `
.edufy-cert-print { display: none; }
@media print {
  @page { size: A4 landscape; margin: 0; }
  html.edufy-printing-certificate, html.edufy-printing-certificate body { margin: 0 !important; padding: 0 !important; background: #fff !important; height: auto !important; overflow: visible !important; }
  html.edufy-printing-certificate body > *:not(.edufy-cert-print) { display: none !important; }
  html.edufy-printing-certificate .edufy-cert-print { display: block !important; position: absolute; left: 0; top: 0; width: 297mm; height: 210mm; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
  html.edufy-printing-certificate .edufy-cert-print .cert-sheet { width: 297mm !important; height: 210mm !important; }
  html.edufy-printing-certificate .edufy-cert-print, html.edufy-printing-certificate .edufy-cert-print * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}`;

function ensurePrintStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);
}

/** Renders the full-size sheet into <body>, hidden on screen and shown only when printing. */
export const CertificatePrintPortal: React.FC<{ certificate: Certificate; siteUrl: string }> = ({ certificate, siteUrl }) => {
  ensurePrintStyle();
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="edufy-cert-print" aria-hidden="true">
      <CertificateDocument certificate={certificate} siteUrl={siteUrl} />
    </div>,
    document.body,
  );
};

async function waitForAssets(root: ParentNode) {
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {
    /* fonts are optional: the fallback serif prints instead */
  }
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          }),
    ),
  );
}

/**
 * Opens the browser's print dialog with only the certificate on an A4 landscape page.
 * Choosing "Save as PDF" gives a vector PDF with selectable text. A <CertificatePrintPortal>
 * for this certificate must be mounted.
 */
export async function printCertificate(certificate: Pick<Certificate, 'studentName' | 'courseTitle'>): Promise<void> {
  ensurePrintStyle();
  const root = document.querySelector('.edufy-cert-print');
  if (root) await waitForAssets(root);
  const html = document.documentElement;
  const previousTitle = document.title;
  // Most browsers use the page title as the suggested PDF file name.
  document.title = certificateFileName(certificate);
  html.classList.add(PRINT_CLASS);
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    html.classList.remove(PRINT_CLASS);
    document.title = previousTitle;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  try {
    window.print();
  } finally {
    // Some mobile browsers return before printing and never fire afterprint.
    window.setTimeout(restore, 60_000);
    if (!('onafterprint' in window)) restore();
  }
}
