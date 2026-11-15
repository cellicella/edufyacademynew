import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSiteSettings } from '../../context/SettingsContext';
import { isHttps } from '../../config/siteSettings';

interface EdufyLogoProps {
  variant?: 'full' | 'icon' | 'white';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  to?: string;
  /** Which admin-managed logo to prefer (Settings → Branding). Falls back to the main logo, then the built-in one. */
  slot?: 'main' | 'login';
}

export const EdufyLogo: React.FC<EdufyLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  to = '/',
  slot = 'main',
}) => {
  const { settings } = useSiteSettings();
  const b = settings.branding;
  const custom = [variant === 'white' ? b.logoDark : slot === 'login' ? b.loginLogo : b.logoLight, b.logoMain].find(isHttps) || '';
  const [failed, setFailed] = useState<string | null>(null);
  const siteName = settings.general.siteName || 'Edufy Academy';
  const isDefaultName = siteName === 'Edufy Academy';
  const tagline = settings.general.tagline;
  const iconSizes = {
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-[18px]',
    md: 'text-[21px]',
    lg: 'text-[26px]',
  };

  const subtextSizes = {
    sm: 'text-[9px] tracking-wider',
    md: 'text-[10px] tracking-widest',
    lg: 'text-[11px] tracking-widest',
  };

  // Official Edufy Academy emblem (client-approved artwork, /public/brand). The emblem reads well
  // on both light and dark backgrounds, so the same file is used for every variant.
  const logoIcon = custom && failed !== custom ? (
    <span className={`relative ${iconSizes[size]} shrink-0`}>
      <img src={custom} alt={siteName} decoding="async" className="w-full h-full object-contain" onError={() => setFailed(custom)} />
    </span>
  ) : (
    <picture className={`relative ${iconSizes[size]} shrink-0`}>
      <source srcSet="/brand/edufy-logo-128.webp 1x, /brand/edufy-logo-256.webp 2x" type="image/webp" />
      <img
        src="/brand/edufy-logo-128.png"
        srcSet="/brand/edufy-logo-128.png 1x, /brand/edufy-logo-256.png 2x"
        alt={siteName}
        width={128}
        height={128}
        decoding="async"
        className="w-full h-full object-contain"
      />
    </picture>
  );

  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {logoIcon}
      {variant !== 'icon' && (
        <div className="flex flex-col leading-none">
          {!isDefaultName ? (
            <span className={`font-display font-extrabold tracking-tight ${variant === 'white' ? 'text-white' : 'text-[#004AAD]'} ${textSizes[size]}`}>{siteName}</span>
          ) : (
          <div className="flex items-center">
            <span
              className={`font-display font-extrabold tracking-tight ${
                variant === 'white' ? 'text-white' : 'text-[#004AAD]'
              } ${textSizes[size]}`}
            >
              Edufy
            </span>
            <span
              className={`font-display font-semibold ml-1.5 ${
                variant === 'white' ? 'text-blue-200' : 'text-[#5E17EB]'
              } ${textSizes[size]}`}
            >
              Academy
            </span>
          </div>
          )}
          {!!tagline && <span
            className={`font-medium uppercase mt-0.5 text-[#64748B] ${
              variant === 'white' ? '!text-blue-100/70' : ''
            } ${subtextSizes[size]}`}
          >
            {tagline}
          </span>}
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center hover:opacity-95 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
};
