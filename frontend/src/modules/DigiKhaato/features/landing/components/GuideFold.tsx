'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { ChevronDown } from 'lucide-react';

import { UbBox, UbButton, UbStack, UbText } from 'src/design-system';
import { cn } from 'src/utils/cn';

/**
 * One guide on a guide page. On a computer it is always open beside the
 * index. On a phone (below `md`) it is a row that opens on tap, so ten guides
 * fit on about one screen instead of sixteen (owner, 17 Nov 2026: "easy to
 * approach"). Following the index's `#guide-…` link opens it too.
 *
 * The body is hidden with CSS rather than unmounted, so the server-rendered
 * HTML keeps every step for search engines and the first paint has no flash.
 */
export function GuideFold({
  id,
  index,
  title,
  className,
  children,
}: Readonly<{
  id: string;
  index: number;
  title: string;
  className?: string;
  children: ReactNode;
}>): React.JSX.Element {
  const [open, setOpen] = useState(index === 0);
  useEffect(() => {
    const follow = (): void => {
      if (window.location.hash === `#${id}`) setOpen(true);
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [id]);

  return (
    <UbBox as="article" id={id} className={className}>
      <UbStack direction="row" align="center" justify="between" gap={3}>
        <UbStack gap={1}>
          <UbText variant="body-sm-medium" tone="accent">
            Guide {index + 1}
          </UbText>
          <UbText as="h3" variant="h3">
            {title}
          </UbText>
        </UbStack>
        <UbButton
          variant="ghost"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => setOpen((value) => !value)}
          className="min-h-11 min-w-11 shrink-0 md:hidden"
          icon={
            <ChevronDown
              aria-hidden
              className={cn('h-5 w-5 transition-transform duration-fast', open && 'rotate-180')}
            />
          }
          iconOnly
        >
          {open ? 'Close guide' : 'Open guide'}
        </UbButton>
      </UbStack>
      <UbBox id={`${id}-body`} className={cn('grid gap-6', !open && 'max-md:hidden')}>
        {children}
      </UbBox>
    </UbBox>
  );
}
