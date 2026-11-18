'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Search } from 'lucide-react';

import { useIsMobileLayer, UbBox, UbButton, UbSearchInput, UbText } from 'src/design-system';
import { deferredModule } from 'src/design-system/primitives/deferredModule';
import { useTranslation } from 'src/hooks/useTranslation';

import type { PaymentContext } from '../../payments/types/payment.types';

/**
 * The open search lives in its own chunk (the three sources, cmdk, the
 * catalogue). It is fetched when the trigger MOUNTS, at idle, not on the tap:
 * fetched on the tap, a phone showed "Loading…" squeezed into the 44 px header
 * slot and the first letters typed while it loaded went nowhere (A1, found by
 * using it).
 */
const panel = deferredModule(() =>
  import('./CounterSearchPanel').then((m) => m.CounterSearchPanel)
);

/**
 * Shown only on the rare open that beats the chunk. It is a real field bound
 * to the same query, so what is typed into it is what the panel opens with.
 */
function PendingField({
  query,
  onQueryChange,
  label,
  placeholder,
  screen,
}: Readonly<{
  query: string;
  onQueryChange: (query: string) => void;
  label: string;
  placeholder: string;
  screen: boolean;
}>): React.JSX.Element {
  return (
    <UbBox
      className={
        screen
          ? 'fixed inset-x-0 top-0 z-50 flex h-[58px] items-center border-b border-border-hairline bg-surface-card px-2'
          : 'min-w-0 flex-1'
      }
    >
      <UbSearchInput
        autoFocus
        value={query}
        onChange={onQueryChange}
        aria-label={label}
        placeholder={placeholder}
        className="w-full"
      />
    </UbBox>
  );
}

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
  const iconOnly = header && mobile && !expanded;
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('');
  const [Panel, setPanel] = useState(() => panel.get());
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (Panel) return undefined;
    let live = true;
    const fetch = () => void panel.load().then((loaded) => live && setPanel(() => loaded));
    const idle = window.requestIdleCallback?.(fetch) ?? window.setTimeout(fetch, 200);
    return () => {
      live = false;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [Panel]);

  const openWith = useCallback((initial: string) => {
    setQuery(initial);
    setOpen(true);
    void panel.load().then((loaded) => setPanel(() => loaded));
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    requestAnimationFrame(() => trigger.current?.focus());
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (document.activeElement?.closest('[role=dialog]')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openWith('');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [openWith]);

  // The desktop list is in place, not a modal: a press outside closes it.
  useEffect(() => {
    if (!open || mobile) return undefined;
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-testid=counter-search], [role=dialog]')) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, mobile]);

  return (
    <UbBox
      data-testid="counter-search"
      className={iconOnly ? 'w-11 shrink-0' : 'relative min-w-0 flex-1'}
    >
      {open && Panel && <Panel onPayment={onPayment} onClosed={close} initialQuery={query} />}
      {open && !Panel && (
        <PendingField
          query={query}
          onQueryChange={setQuery}
          label={t('shopSearch.label')}
          placeholder={t('shopSearch.placeholder')}
          screen={mobile}
        />
      )}
      {/* On a phone the screen covers the header, so the magnifier stays put
          underneath and Back returns focus to it; on a desktop the open field
          takes the trigger's place. */}
      {(!open || mobile) && (
        <>
          <UbButton
            ref={trigger}
            variant={iconOnly ? 'ghost' : 'outlineNeutral'}
            iconOnly={iconOnly}
            className={
              iconOnly
                ? 'h-11 w-11 shrink-0'
                : 'w-full justify-start overflow-hidden whitespace-nowrap font-normal text-text-tertiary'
            }
            icon={<Search aria-hidden className="h-4 w-4" />}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={t('shopSearch.label')}
            onClick={() => openWith('')}
            onKeyDown={(e) => {
              if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                openWith(e.key);
              }
            }}
          >
            {iconOnly ? t('shopSearch.label') : t('shopSearch.placeholder')}
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
