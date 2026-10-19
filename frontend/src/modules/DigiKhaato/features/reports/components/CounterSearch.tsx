'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import dynamic from 'next/dynamic';

import { Search } from 'lucide-react';

import { useIsMobileLayer, UbBox, UbButton, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import type { PaymentContext } from '../../payments/types/payment.types';

function SearchPending(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <UbButton
      disabled
      busy
      busyLabel={t('common.loading')}
      className="w-full"
      variant="outlineNeutral"
    >
      {t('common.loading')}
    </UbButton>
  );
}
const Panel = dynamic(() => import('./CounterSearchPanel').then((m) => m.CounterSearchPanel), {
  loading: SearchPending,
});

/** Visible command trigger; its searches and services belong to the opening tap. */
export function CounterSearch({
  onPayment,
  header = false,
  expanded = false,
}: Readonly<{
  onPayment: (context: PaymentContext) => void;
  header?: boolean;
  expanded?: boolean;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const mobile = useIsMobileLayer();
  const [open, setOpen] = useState(false),
    [initialQuery, setInitialQuery] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (document.activeElement?.closest('[role=dialog]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setInitialQuery('');
        setOpen(true);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <UbBox
      data-testid="counter-search"
      className={header && mobile && !expanded ? 'w-11 shrink-0' : 'min-w-0 flex-1'}
    >
      {open ? (
        <Panel
          onPayment={onPayment}
          onClosed={close}
          initialQuery={initialQuery}
          compact={header && mobile && !expanded}
          inHeader={header}
        />
      ) : (
        <>
          <UbButton
            ref={trigger}
            variant={header && mobile && !expanded ? 'ghost' : 'outlineNeutral'}
            iconOnly={header && mobile && !expanded}
            className={
              header && mobile && !expanded
                ? 'h-11 w-11 shrink-0'
                : 'w-full justify-start whitespace-normal font-normal'
            }
            icon={<Search aria-hidden className="h-4 w-4" />}
            aria-haspopup="listbox"
            aria-label={t('shopSearch.label')}
            onClick={() => {
              setInitialQuery('');
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                setInitialQuery(e.key);
                setOpen(true);
              }
            }}
          >
            {t(mobile ? 'shopSearch.label' : 'shopSearch.placeholder')}
          </UbButton>
          {!header && (
            <UbText variant="caption" tone="tertiary" className="mt-1 hidden lg:block">
              {t('shopSearch.shortcut')}
            </UbText>
          )}
        </>
      )}
    </UbBox>
  );
}
