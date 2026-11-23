'use client';

import { useEffect, useState } from 'react';

import {
  UbBox,
  UbButton,
  UbPanel,
  UbQuantityInput,
  UbSelect,
  UbStack,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { toApiError } from 'src/utils/apiError';

import { getEway, saveEway, type EwayTransport } from '../api/ewayService';

/**
 * D P5 — design D10 "Make an e-way bill?": on an issued bill over ₹50,000
 * going to another state, the transporter, vehicle no., distance and mode, and
 * "Make file for GST portal", which downloads the portal's upload file. Direct
 * connection to the portal comes later (plan §P5 needs a provider first).
 */
export function EwayBillCard({
  id,
  number,
}: Readonly<{ id: string; number: string | null }>): React.JSX.Element | null {
  const { t } = useTranslation();
  const [offered, setOffered] = useState(false);
  const [form, setForm] = useState<EwayTransport>({
    transporter: '',
    vehicle_number: '',
    distance_km: 0,
    mode: 'road',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void getEway(id, controller.signal)
      .then((state) => {
        setOffered(state.offered);
        if (state.transport) setForm(state.transport);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [id]);

  if (!offered) return null;

  const make = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await saveEway(id, form);
      const state = await getEway(id);
      const blob = new Blob([JSON.stringify(state.file, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: `eway-${(number ?? id).replace(/[^\w-]+/g, '-')}.json`,
      });
      link.click();
      URL.revokeObjectURL(url);
    } catch (thrown) {
      setError(toApiError(thrown).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <UbPanel className="border-accent-line bg-accent-quiet p-4" data-testid="eway-card">
      <UbStack gap={3}>
        <UbStack gap={1}>
          <UbText as="p" variant="body-medium">
            {t('sales.eway.title')}
          </UbText>
          <UbText as="p" variant="body-sm" tone="secondary">
            {t('sales.eway.why')}
          </UbText>
        </UbStack>
        <UbStack gap={1}>
          <UbText as="span" variant="label">
            {t('sales.eway.transporter')}
          </UbText>
          <UbTextInput
            aria-label={t('sales.eway.transporter')}
            value={form.transporter}
            onChange={(next) => setForm({ ...form, transporter: next })}
            maxLength={100}
          />
        </UbStack>
        <UbStack gap={1}>
          <UbText as="span" variant="label">
            {t('sales.eway.vehicle')}
          </UbText>
          <UbTextInput
            aria-label={t('sales.eway.vehicle')}
            value={form.vehicle_number}
            onChange={(next) => setForm({ ...form, vehicle_number: next.toUpperCase() })}
            maxLength={15}
            data-testid="eway-vehicle"
          />
        </UbStack>
        <UbBox className="grid grid-cols-2 gap-3">
          <UbStack gap={1}>
            <UbText as="span" variant="label">
              {t('sales.eway.distance')}
            </UbText>
            <UbQuantityInput
              aria-label={t('sales.eway.distance')}
              value={form.distance_km ? String(form.distance_km) : ''}
              onChange={(next) => setForm({ ...form, distance_km: Number(next) || 0 })}
              decimals={0}
              unit="km"
              data-testid="eway-distance"
            />
          </UbStack>
          <UbStack gap={1}>
            <UbText as="span" variant="label">
              {t('sales.eway.mode')}
            </UbText>
            <UbSelect
              aria-label={t('sales.eway.mode')}
              value={form.mode}
              onChange={(next) => setForm({ ...form, mode: next as EwayTransport['mode'] })}
              options={(['road', 'rail', 'air', 'ship'] as const).map((mode) => ({
                value: mode,
                label: t(`sales.eway.mode.${mode}`),
              }))}
            />
          </UbStack>
        </UbBox>
        {error && (
          <UbText as="p" variant="caption" tone="error">
            {error}
          </UbText>
        )}
        <UbButton variant="primary" busy={busy} onClick={() => void make()} data-testid="eway-make">
          {t('sales.eway.make')}
        </UbButton>
        <UbText as="p" variant="caption" tone="tertiary">
          {t('sales.eway.note')}
        </UbText>
      </UbStack>
    </UbPanel>
  );
}
