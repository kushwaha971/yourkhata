'use client';

import { ScanLine } from 'lucide-react';

import { UbButton } from 'src/design-system/UbButton';

/**
 * C1 / C2 (design `addbar .scanbtn`) — the teal 44 px camera button that sits
 * beside a search box and opens `UbScanSheet`. One component, so the bill's
 * item search and the Items list draw the same button.
 */
export function UbScanButton({
  label,
  onClick,
  disabled = false,
  'data-testid': testId = 'open-camera-scan',
}: Readonly<{
  /** "Scan with camera" — the accessible name; the face is the icon. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  'data-testid'?: string;
}>): React.JSX.Element {
  return (
    <UbButton
      variant="primary"
      iconOnly
      icon={<ScanLine aria-hidden className="h-5 w-5" />}
      className="h-11 w-11 shrink-0 !bg-action !text-white"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
    >
      {label}
    </UbButton>
  );
}
