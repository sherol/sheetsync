import React, { useId } from 'react';

interface SquirrelIconProps {
  className?: string;
  size?: number;
  alt?: string;
  /** 'outline' = white outline on the rainbow tile (favicon); 'mascot' = brown cartoon squirrel. */
  variant?: 'outline' | 'mascot';
}

const mascotSrc = () => {
  const base = import.meta.env.BASE_URL || './';
  return `${base.endsWith('/') ? base : `${base}/`}squirrel-icon.png`;
};

/**
 * SheetSync logo. The default is the white squirrel outline on a rainbow tile,
 * the same artwork as public/favicon.svg, inlined so it renders without a
 * separate request. The 'mascot' variant is the brown cartoon squirrel.
 */
export const SquirrelIcon: React.FC<SquirrelIconProps> = ({
  className = 'w-6 h-6',
  size,
  alt = 'SheetSync',
  variant = 'outline',
}) => {
  // Gradient ids must be unique per instance; strip the punctuation useId adds so url(#...) references stay valid.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string) => `sq-${uid}-${name}`;

  if (variant === 'mascot') {
    return (
      <img
        src={mascotSrc()}
        alt={alt}
        width={size}
        height={size}
        className={`select-none object-cover ${className}`}
        draggable={false}
      />
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={alt}
    >
      <defs>
        <linearGradient id={id('base')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b21b6" />
          <stop offset="0.5" stopColor="#ec4899" />
          <stop offset="1" stopColor="#facc15" />
        </linearGradient>
        <radialGradient id={id('tr')} cx="1" cy="0" r="0.75">
          <stop offset="0" stopColor="#ff3b30" />
          <stop offset="1" stopColor="#ff3b30" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('r')} cx="1" cy="0.6" r="0.55">
          <stop offset="0" stopColor="#fde047" />
          <stop offset="1" stopColor="#fde047" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('bl')} cx="0" cy="0.85" r="0.7">
          <stop offset="0" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('b')} cx="0.5" cy="1" r="0.5">
          <stop offset="0" stopColor="#22c55e" />
          <stop offset="1" stopColor="#22c55e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('tl')} cx="0" cy="0" r="0.6">
          <stop offset="0" stopColor="#4c1d95" />
          <stop offset="1" stopColor="#4c1d95" stopOpacity="0" />
        </radialGradient>
        <clipPath id={id('tile')}>
          <rect width="100" height="100" rx="22" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id('tile')})`}>
        {['base', 'tr', 'r', 'bl', 'b', 'tl'].map((g) => (
          <rect key={g} width="100" height="100" fill={`url(#${id(g)})`} />
        ))}
      </g>
      <g fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 86 L58 86 C66 80 66 62 58 54 C52 48 47 46 45 42 C47 36 46 30 42 26 C46 21 46 14 41 14 C37 14 36 18 36 21 C34 17 31 14 28 16 C25 18 26 22 29 24 C23 23 17 28 15 34 C14 37 12 39 13 41 C16 45 21 45 24 46 C25 49 20 52 15 53 C12 54 12 58 15 58 C21 57 26 58 30 60 C26 66 25 73 27 79 C21 79 15 81 15 86 Z" />
        <path d="M58 54 C52 44 52 28 62 20 C72 13 86 20 86 32 C86 36 85 39 84 41 C80 36 74 36 72 40 C70 45 75 52 78 60 C82 72 74 84 60 86" />
        <path d="M48 61 C40 63 37 70 40 77 C33 77 27 80 28 86" />
      </g>
    </svg>
  );
};
