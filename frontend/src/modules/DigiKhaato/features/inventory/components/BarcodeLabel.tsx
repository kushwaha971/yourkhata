'use client';

import { UbStack, UbText } from 'src/design-system';
import { cn } from 'src/utils/cn';
import { code128Widths } from 'src/utils/code128';

/**
 * D P2 (design D9) — one 50 × 25 mm label: the business's name, the item,
 * the Code 128 bars and their text, and the price when asked. The bars are an
 * SVG drawn from module widths, so they print crisp at any printer's dots.
 */
export function BarcodeLabel({
  business,
  name,
  code,
  price,
  className,
}: Readonly<{
  business: string;
  name: string;
  code: string;
  price: string | null;
  className?: string;
}>): React.JSX.Element {
  const widths = code128Widths(code);
  const total = widths.reduce((sum, w) => sum + w, 0);
  // Each bar's left edge is the sum of every width before it.
  const starts = widths.map((_, index) => widths.slice(0, index).reduce((sum, w) => sum + w, 0));
  const bars = widths.flatMap((w, index) =>
    index % 2 === 0 ? [<rect key={index} x={starts[index]} y={0} width={w} height={30} />] : []
  );
  return (
    <UbStack
      gap={0.5}
      className={cn(
        'ub-label h-[25mm] w-[50mm] overflow-hidden rounded-sm border border-dashed border-border-strong bg-white p-[1.5mm] text-black',
        className
      )}
      data-testid="barcode-label"
    >
      {/* Sizes in mm so a label reads the same on screen and on 50 × 25 mm paper. */}
      <UbText as="span" variant="inherit" className="truncate text-[2.6mm] font-semibold leading-[1.2] text-black">
        {business}
      </UbText>
      <UbText as="span" variant="inherit" className="truncate text-[2.6mm] leading-[1.2] text-black">
        {name}
      </UbText>
      {total > 0 && (
        <svg
          viewBox={`0 0 ${total} 30`}
          preserveAspectRatio="none"
          className="h-[9mm] w-full shrink-0"
          role="img"
          aria-label={code}
        >
          <g fill="#000">{bars}</g>
        </svg>
      )}
      <UbText as="span" variant="inherit" className="truncate text-[2.4mm] leading-[1.2] text-black">
        {price ? `${code} · ${price}` : code}
      </UbText>
    </UbStack>
  );
}
