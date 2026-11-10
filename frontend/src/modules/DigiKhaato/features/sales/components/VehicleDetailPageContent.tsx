'use client';

import { useEffect, useMemo, useState } from 'react';

import { Plus, Wrench } from 'lucide-react';

import {
  UbActionLink,
  UbBox,
  UbButton,
  UbCard,
  UbEditTable,
  UbLink,
  UbPageHeader,
  UbPageShell,
  UbSearchInput,
  UbSkeleton,
  UbStack,
  UbText,
} from 'src/design-system';
import { useIsMobileLayer } from 'src/design-system/motion/useMediaQuery';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { getVehicle, type VehicleDetail } from '../api/vehicleService';

/** G8 — one vehicle (design dVehicle): its bills, what it spent, its mechanic's dues. */
export function VehicleDetailPageContent({ number }: Readonly<{ number: string }>): React.JSX.Element {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const isPhone = useIsMobileLayer();
  const [vehicle, setVehicle] = useState<VehicleDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getVehicle(number, controller.signal)
      .then((next) => {
        setVehicle(next);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [number, attempt]);

  const shown = useMemo(() => {
    const text = search.trim().toLowerCase();
    const rows = vehicle?.bill_rows ?? [];
    return text
      ? rows.filter((b) => `${b.number} ${b.parts} ${b.mechanic ?? ''}`.toLowerCase().includes(text))
      : rows;
  }, [vehicle, search]);

  if (failed)
    return (
      <UbPageShell>
        <UbStack gap={3} className="items-start">
          <UbText>{t('sales.vehicle.error')}</UbText>
          <UbButton onClick={() => setAttempt((n) => n + 1)}>{t('common.action.retry')}</UbButton>
        </UbStack>
      </UbPageShell>
    );
  if (!vehicle)
    return (
      <UbPageShell>
        <UbSkeleton className="h-64 w-full" />
      </UbPageShell>
    );

  const subtitle = [
    vehicle.model,
    vehicle.owner ? t('sales.vehicle.owner', { name: vehicle.owner }) : null,
    vehicle.mechanic ? t('sales.vehicle.comesWith', { name: vehicle.mechanic }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const params = new URLSearchParams({ vehicle: vehicle.number });
  if (vehicle.model) params.set('model', vehicle.model);
  if (vehicle.mechanic) params.set('mechanic', vehicle.mechanic);
  if (vehicle.owner_id && vehicle.owner) {
    params.set('party', vehicle.owner_id);
    params.set('partyName', vehicle.owner);
  }
  const partsHref = vehicle.model ? `${ROUTES.SALES_PARTS_FIT}?fits=${encodeURIComponent(vehicle.model)}` : ROUTES.SALES_PARTS_FIT;
  const tiles = [
    { label: t('sales.vehicle.bills'), value: String(vehicle.bills), note: t('sales.vehicle.since', { date: formatBusinessDate(vehicle.since) }) },
    { label: t('sales.vehicle.spent'), value: formatInr(vehicle.spent), note: t('sales.vehicle.spentNote') },
    // Design dVehicle: "Last oil change · 12 Aug · Castrol 20W-40 1 L", from its own bills.
    {
      label: t('sales.vehicle.lastOil'),
      value: vehicle.last_oil ? formatBusinessDate(vehicle.last_oil.date) : '—',
      note: vehicle.last_oil?.item ?? t('sales.vehicle.noOil'),
    },
    ...(vehicle.garage
      ? [{ label: t('sales.vehicle.mechanicDues'), value: formatInr(vehicle.garage.due), note: vehicle.garage.name, tone: 'get' as const }]
      : []),
  ];

  const actions = isPhone ? (
    <UbBox className="grid grid-cols-2 gap-2">
          <UbActionLink href={partsHref} variant="outlineNeutral" icon={<Wrench className="h-4 w-4" aria-hidden />} data-testid="vehicle-parts">
            {t('sales.vehicle.partsFit')}
          </UbActionLink>
          {can('sales.invoice.write') && (
            <UbActionLink
              href={`${ROUTES.SALES_INVOICES}/new?${params.toString()}`}
              variant="primary"
              icon={<Plus className="h-4 w-4" aria-hidden />}
              data-testid="vehicle-new-bill"
            >
              {t('sales.vehicle.newBill')}
            </UbActionLink>
          )}
    </UbBox>
  ) : (
    <UbStack direction="row" gap={2}>
          <UbActionLink href={partsHref} variant="outlineNeutral" icon={<Wrench className="h-4 w-4" aria-hidden />} data-testid="vehicle-parts">
            {t('sales.vehicle.partsFit')}
          </UbActionLink>
          {can('sales.invoice.write') && (
            <UbActionLink
              href={`${ROUTES.SALES_INVOICES}/new?${params.toString()}`}
              variant="primary"
              icon={<Plus className="h-4 w-4" aria-hidden />}
              data-testid="vehicle-new-bill"
            >
              {t('sales.vehicle.newBill')}
            </UbActionLink>
          )}
    </UbStack>
  );

  return (
    <UbPageShell>
      <UbPageHeader
        title={vehicle.number}
        subtitle={subtitle || undefined}
        actions={isPhone ? undefined : actions}
      />
      <UbStack gap={3} data-testid="vehicle-screen">
        {isPhone && actions}
        {/* Design dVehicle's `.dayl`: one ruled strip (1.5 px ink rule over a
            hairline, dividers between cells), not four cards. */}
        <UbBox
          className={`grid grid-cols-2 border-b border-t-[1.5px] border-b-border-hairline border-t-text-primary ${tiles.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}
          data-testid="vehicle-tiles"
        >
          {tiles.map((tile, index) => (
            <UbStack
              key={tile.label}
              gap={0}
              className={`min-w-0 gap-px px-[14px] py-[10px] ${index % 2 ? 'border-l border-border-hairline' : ''} ${index > 0 ? 'lg:border-l lg:border-border-hairline' : ''} ${index > 1 ? 'max-lg:border-t max-lg:border-border-hairline' : ''}`}
            >
              <UbText variant="inherit" className="text-[12px] font-semibold text-text-tertiary">
                {tile.label}
              </UbText>
              <UbText
                variant="inherit"
                className={`text-[22px] font-extrabold tabular-nums leading-tight ${'tone' in tile ? 'text-success-700 dark:text-success-400' : ''}`}
              >
                {tile.value}
              </UbText>
              <UbText variant="inherit" className="truncate text-[12px] text-text-tertiary">
                {tile.note}
              </UbText>
            </UbStack>
          ))}
        </UbBox>
        <UbSearchInput value={search} onChange={setSearch} placeholder={t('sales.vehicle.searchBills')} aria-label={t('sales.vehicle.searchBills')} />
        {isPhone ? (
          <UbCard>
            <UbStack gap={3} data-testid="vehicle-bills">
              {shown.map((bill) => (
                <UbActionLink key={bill.id} href={`${ROUTES.SALES_INVOICES}/${bill.id}`} variant="ghost" className="h-auto w-full py-1 text-left [&>*]:w-full" data-testid="vehicle-bill">
                  <UbStack direction="row" gap={2} className="w-full items-center justify-between">
                    <UbStack gap={0} className="min-w-0">
                      <UbText variant="body-sm" className="font-semibold">{bill.number} · {formatBusinessDate(bill.date)}</UbText>
                      <UbText variant="caption" tone="secondary" className="line-clamp-2">{bill.parts}</UbText>
                      <UbText variant="caption" tone="secondary">{bill.mechanic ?? t('sales.vehicle.self')}</UbText>
                    </UbStack>
                    <UbText variant="body-sm" className="shrink-0 font-semibold">{formatInr(bill.total)}</UbText>
                  </UbStack>
                </UbActionLink>
              ))}
            </UbStack>
          </UbCard>
        ) : (
          <UbEditTable
            data-testid="vehicle-bills"
            columns={[
              { id: 'date', header: t('sales.vehicle.col.date'), width: '110px' },
              { id: 'bill', header: t('sales.vehicle.col.bill'), width: '130px' },
              { id: 'parts', header: t('sales.vehicle.col.parts'), wrap: true },
              { id: 'mechanic', header: t('sales.vehicle.col.mechanic'), width: '180px' },
              { id: 'amount', header: t('sales.vehicle.col.amount'), align: 'end', width: '120px' },
            ]}
            rows={shown.map((bill) => ({
              key: bill.id,
              'data-testid': 'vehicle-bill',
              cells: [
                formatBusinessDate(bill.date),
                <UbLink key="bill" href={`${ROUTES.SALES_INVOICES}/${bill.id}`}>{bill.number}</UbLink>,
                bill.parts,
                bill.mechanic ?? t('sales.vehicle.self'),
                formatInr(bill.total),
              ],
            }))}
          />
        )}
      </UbStack>
    </UbPageShell>
  );
}
