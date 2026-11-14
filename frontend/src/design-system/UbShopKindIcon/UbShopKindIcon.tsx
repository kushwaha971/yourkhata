import { memo } from 'react';

import { cn } from 'src/utils/cn';

/**
 * B1 — the ten shop-kind pictures from the approved design
 * (`docs/revamp/design/shop-fixes-and-business-types.html`, symbols `b-*`),
 * drawn on a 40 × 40 grid in `currentColor` so the tile's own colour paints
 * them in both themes. Copied path for path: a near-enough icon from a
 * library is the "close" R-DEC-50 calls a failure.
 */
export type UbShopKind =
  | 'kirana'
  | 'medical'
  | 'mobile'
  | 'garments'
  | 'hardware'
  | 'auto'
  | 'wholesale'
  | 'cafe'
  | 'jewel'
  | 'other';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinejoin: 'round' as const,
};

const PATHS: Record<UbShopKind, React.JSX.Element> = {
  kirana: (
    <g {...STROKE}>
      <path d="M5 15h30l-2-8H7zM7 15v18h26V15M16 33v-9h8v9" />
      <path d="M5 15c0 3 5 3 5 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 5 3 5 0" />
    </g>
  ),
  medical: (
    <g {...STROKE}>
      <rect x="6" y="6" width="28" height="28" rx="6" />
      <path d="M17 12h6v5h5v6h-5v5h-6v-5h-5v-6h5z" />
    </g>
  ),
  mobile: (
    <g fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="12" y="4" width="16" height="32" rx="3" />
      <path d="M18 31h4" strokeLinecap="round" />
    </g>
  ),
  garments: (
    <path
      d="M14 5 5 10l3 8 4-2v19h16V16l4 2 3-8-9-5c-1 3-3 4-6 4s-5-1-6-4z"
      {...STROKE}
    />
  ),
  hardware: (
    <g {...STROKE} strokeLinecap="round">
      <path d="M22 6a8 8 0 0 0-8 10L6 24l4 4 8-8a8 8 0 0 0 10-8l-5 2-3-3 2-5z" />
      <path d="M26 26l8 8" />
    </g>
  ),
  auto: (
    <g fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="20" cy="20" r="13" />
      <circle cx="20" cy="20" r="4" />
      <path d="M20 7v9M20 24v9M7 20h9M24 20h9" />
    </g>
  ),
  wholesale: (
    <g {...STROKE}>
      <rect x="5" y="20" width="14" height="14" />
      <rect x="21" y="20" width="14" height="14" />
      <rect x="13" y="6" width="14" height="14" />
    </g>
  ),
  cafe: (
    <g {...STROKE} strokeLinecap="round">
      <path d="M7 16h22v6a9 9 0 0 1-9 9h-4a9 9 0 0 1-9-9zM29 18h2a4 4 0 0 1 0 8h-3" />
      <path d="M14 6c-2 2 2 4 0 6M20 6c-2 2 2 4 0 6" />
    </g>
  ),
  jewel: <path d="M12 7h16l6 8-14 18L6 15zM6 15h28M16 7l4 26M24 7l-4 26" {...STROKE} />,
  other: (
    <g fill="currentColor">
      <circle cx="11" cy="20" r="3" />
      <circle cx="20" cy="20" r="3" />
      <circle cx="29" cy="20" r="3" />
    </g>
  ),
};

export interface UbShopKindIconProps {
  readonly kind: UbShopKind;
  readonly className?: string;
}

function UbShopKindIconBase({ kind, className }: Readonly<UbShopKindIconProps>) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden focusable="false" className={cn('h-[34px] w-[34px]', className)}>
      {PATHS[kind]}
    </svg>
  );
}

UbShopKindIconBase.displayName = 'UbShopKindIcon';
export const UbShopKindIcon = memo(UbShopKindIconBase);
