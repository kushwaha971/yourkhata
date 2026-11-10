'use client';

import { useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import {
  UbButton,
  UbCard,
  UbChoiceChips,
  UbPageHeader,
  UbPageShell,
  UbSearchInput,
  UbSkeleton,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useDebounce } from 'src/hooks/useDebounce';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';
import { formatQuantity } from 'src/utils/quantity';

import { listFittingParts, type FitPart } from '../api/vehicleService';

const ALL = 'all';

const stockWords = (part: FitPart, t: TranslateFn): string => {
  if (!part.track_stock) return '';
  if (part.stock_status === 'out') return t('sales.fits.out');
  const count = formatQuantity(part.on_hand);
  return t(part.stock_status === 'low' ? 'sales.fits.left' : 'sales.fits.inStock', { count });
};

/** G8 — parts that fit a vehicle (design pVehicle): make and model, then what fits, with rack and stock. */
export function PartsFitPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const [fitsText, setFitsText] = useState(useSearchParams().get('fits') ?? '');
  const [search, setSearch] = useState('');
  const fits = useDebounce(fitsText.trim(), 300);
  const q = useDebounce(search.trim(), 300);
  const [parts, setParts] = useState<readonly FitPart[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [group, setGroup] = useState<string>(ALL);

  useEffect(() => {
    if (!fits) return undefined;
    const controller = new AbortController();
    listFittingParts({ fits, q }, controller.signal)
      .then((next) => {
        setParts(next);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [fits, q, attempt]);

  // The groups are the categories of what fits, never a fixed list.
  const groups = useMemo(() => {
    const seen = new Map<string, string>();
    for (const part of parts ?? []) if (part.category) seen.set(part.category.id, part.category.name);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [parts]);
  const shown = (parts ?? []).filter((part) => group === ALL || part.category?.id === group);

  let body: React.ReactNode;
  if (!fits) body = <UbText tone="secondary">{t('sales.fits.empty')}</UbText>;
  else if (failed)
    body = (
      <UbStack gap={2} className="items-start">
        <UbText>{t('sales.fits.error')}</UbText>
        <UbButton variant="secondary" onClick={() => setAttempt((n) => n + 1)}>{t('common.action.retry')}</UbButton>
      </UbStack>
    );
  else if (!parts) body = <UbSkeleton className="h-40 w-full" />;
  else if (shown.length === 0) body = <UbText tone="secondary">{t('sales.fits.none')}</UbText>;
  else
    body = (
      <UbCard>
        <UbStack gap={3} data-testid="fits-parts">
          {shown.map((part) => {
            const code = part.part_numbers[0] ?? part.sku;
            const where = [code, part.rack ? t('sales.fits.rack', { rack: part.rack }) : null].filter(Boolean).join(' · ');
            return (
              <UbStack key={part.id} direction="row" gap={2} className="items-center justify-between" data-testid="fits-part">
                <UbStack gap={0} className="min-w-0">
                  <UbText variant="body-sm" className="font-semibold">{part.name}</UbText>
                  {where && <UbText variant="caption" tone="secondary">{where}</UbText>}
                </UbStack>
                <UbStack gap={0} className="shrink-0 items-end">
                  <UbText variant="body-sm" className="font-semibold">{formatInr(part.selling_price)}</UbText>
                  <UbText variant="caption" tone={part.stock_status === 'out' ? 'error' : 'secondary'}>{stockWords(part, t)}</UbText>
                </UbStack>
              </UbStack>
            );
          })}
        </UbStack>
      </UbCard>
    );

  return (
    <UbPageShell>
      <UbPageHeader title={t('sales.fits.title')} />
      <UbStack gap={3} className="lg:max-w-2xl" data-testid="fits-screen">
        <UbTextInput
          aria-label={t('sales.fits.vehicle')}
          placeholder={t('sales.fits.vehiclePlaceholder')}
          value={fitsText}
          onChange={setFitsText}
          maxLength={80}
          data-testid="fits-vehicle"
        />
        {fits && <UbSearchInput value={search} onChange={setSearch} placeholder={t('sales.fits.search')} aria-label={t('sales.fits.search')} />}
        {groups.length > 1 && (
          <UbChoiceChips
            ariaLabel={t('sales.fits.title')}
            value={group}
            onChange={setGroup}
            options={[{ value: ALL, label: t('sales.fits.all') }, ...groups]}
          />
        )}
        {body}
        <UbText variant="caption" tone="secondary">{t('sales.fits.hint')}</UbText>
      </UbStack>
    </UbPageShell>
  );
}
