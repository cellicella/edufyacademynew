import React from 'react';
import { Link } from 'react-router-dom';

interface EdufyLogoProps {
  variant?: 'full' | 'icon' | 'white';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  to?: string;
}

export const EdufyLogo: React.FC<EdufyLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  to = '/',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const subtextSizes = {
    sm: 'text-[9px] tracking-wider',
    md: 'text-[10px] tracking-widest',
    lg: 'text-xs tracking-widest',
  };

  const logoIcon = (
    <div className={`relative ${iconSizes[size]} shrink-0 flex items-center justify-center`}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        {/* Outer Shield / Geometric Portal */}
        <rect
          x="3"
          y="3"
          width="42"
          height="42"
          rx="12"
          fill={variant === 'white' ? '#FFFFFF' : '#004AAD'}
        />
        {/* Academic Mortarboard Graduation Cap */}
        <path
          d="M24 12L37 18.5L24 25L11 18.5L24 12Z"
          fill={variant === 'white' ? '#004AAD' : '#FFFFFF'}
        />
        {/* Cap Base & Tassel Accent in Accent Purple */}
        <path
          d="M17 21.5V28C17 31.5 24 33.5 24 33.5C24 33.5 31 31.5 31 28V21.5L24 25L17 21.5Z"
          fill={variant === 'white' ? '#5271FF' : '#5271FF'}
          opacity="0.95"
        />
        {/* Dynamic Graduation Cap Tassel Drop in Purple */}
        <path
          d="M36 19.5V26.5C36 27.5 35 28 34.2 27.5L34 27.3"
          stroke={variant === 'white' ? '#5E17EB' : '#FFFFFF'}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Spark of Knowledge Star / Beacon */}
        <circle
          cx="24"
          cy="23"
          r="2.2"
          fill={variant === 'white' ? '#FFFFFF' : '#5E17EB'}
        />
      </svg>
    </div>
  );

  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {logoIcon}
      {variant !== 'icon' && (
        <div className="flex flex-col leading-none">
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
          <span
            className={`font-medium uppercase mt-0.5 text-[#64748B] ${
              variant === 'white' ? '!text-blue-100/70' : ''
            } ${subtextSizes[size]}`}
          >
            Excellence in Learning
          </span>
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
