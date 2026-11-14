'use client';

import { useEffect, useMemo, useState } from 'react';

import { Wrench } from 'lucide-react';

import { UbActionLink, UbPageHeader, UbPageShell, UbSearchInput, UbStack } from 'src/design-system';
import { UbButton } from 'src/design-system';
import { useIsMobileLayer } from 'src/design-system/motion/useMediaQuery';
import {
  UbDataGrid,
  useGridTier,
  type UbDataGridColumn,
  type UbGridState,
  type UbGridTier,
} from 'src/design-system/UbDataGrid';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useDebounce } from 'src/hooks/useDebounce';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { inventoryGridLabels } from 'modules/DigiKhaato/features/inventory/view-model/gridLabels';

import { listVehicles, type VehicleRow } from '../api/vehicleService';

export const vehicleHref = (number: string): string => `${ROUTES.SALES_VEHICLES}/${encodeURIComponent(number)}`;

const bills = (v: VehicleRow, t: TranslateFn): string =>
  t(v.bills === 1 ? 'sales.vehicle.oneBill' : 'sales.vehicle.billCount', { count: v.bills });

const createColumns = (t: TranslateFn, tier: UbGridTier): UbDataGridColumn<VehicleRow>[] => {
  if (tier === 'cards')
    return [
      { id: 'number', header: t('sales.vehicle.col.number'), priority: 1, cardSlot: 'title', cell: (v) => v.number },
      {
        id: 'meta',
        header: t('sales.vehicle.col.model'),
        priority: 1,
        cardSlot: 'meta',
        cell: (v) => [v.model, v.owner, bills(v, t)].filter(Boolean).join(' · '),
      },
      { id: 'spent', header: t('sales.vehicle.col.spent'), priority: 1, cardSlot: 'trailing', cell: (v) => formatInr(v.spent) },
    ];
  return [
    { id: 'number', header: t('sales.vehicle.col.number'), priority: 1, cardSlot: 'none', widthShare: 16, cell: (v) => v.number },
    { id: 'model', header: t('sales.vehicle.col.model'), priority: 2, cardSlot: 'none', widthShare: 20, cell: (v) => v.model ?? '—' },
    { id: 'owner', header: t('sales.vehicle.col.owner'), priority: 1, cardSlot: 'none', widthShare: 18, cell: (v) => v.owner ?? '—' },
    { id: 'mechanic', header: t('sales.vehicle.col.mechanic'), priority: 2, cardSlot: 'none', widthShare: 16, cell: (v) => v.mechanic ?? '—' },
    { id: 'bills', header: t('sales.vehicle.col.bills'), priority: 2, cardSlot: 'none', widthShare: 8, cell: (v) => String(v.bills) },
    { id: 'last', header: t('sales.vehicle.col.lastBill'), priority: 2, cardSlot: 'none', widthShare: 10, cell: (v) => formatBusinessDate(v.last_bill) },
    { id: 'spent', header: t('sales.vehicle.col.spent'), priority: 1, cardSlot: 'none', align: 'end', widthShare: 12, cell: (v) => formatInr(v.spent) },
  ];
};

/** G8 — `/sales/vehicles`: every vehicle a bill has named, latest first. */
export function VehiclesPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useAppRouter();
  const tier = useGridTier();
  const isPhone = useIsMobileLayer();
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const [rows, setRows] = useState<readonly VehicleRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    listVehicles(q, controller.signal)
      .then((next) => {
        setRows(next);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [q, attempt]);

  const columns = useMemo(() => createColumns(t, tier), [t, tier]);
  const list = rows ?? [];
  const gridState: UbGridState = failed
    ? 'error'
    : !rows
      ? 'loading'
      : list.length === 0
        ? search
          ? 'filtered-empty'
          : 'empty'
        : 'rows';
  const searchBox = (
    <UbSearchInput value={search} onChange={setSearch} placeholder={t('sales.vehicle.search')} aria-label={t('sales.vehicle.search')} />
  );
  const partsLink = (
    <UbActionLink href={ROUTES.SALES_PARTS_FIT} variant="secondary" icon={<Wrench className="h-4 w-4" aria-hidden />} data-testid="vehicles-parts">
      {t('sales.vehicle.partsFit')}
    </UbActionLink>
  );

  return (
    <UbPageShell>
      <UbPageHeader title={t('sales.vehicle.title')} subtitle={isPhone ? undefined : t('sales.vehicle.subtitle')} primaryAction={partsLink} />
      <UbStack gap={3} data-testid="vehicles-screen">
        {isPhone && searchBox}
        <UbDataGrid
          variant="register"
          toolbar={isPhone ? undefined : searchBox}
          rows={list}
          columns={columns}
          rowId={(v) => v.number}
          rowName={(v) => v.number}
          state={gridState}
          labels={inventoryGridLabels(t, {
            loading: 'sales.vehicle.loading',
            open: 'sales.vehicle.open',
            selectAll: 'sales.vehicle.title',
            selectRow: 'sales.vehicle.title',
          })}
          emptyStates={{
            firstUse: { title: t('sales.vehicle.empty.title'), description: t('sales.vehicle.empty.body') },
            filtered: { title: t('sales.vehicle.noMatch'), description: '' },
            error: {
              title: t('sales.vehicle.error'),
              description: '',
              action: (
                <UbButton variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                  {t('common.action.retry')}
                </UbButton>
              ),
            },
          }}
          caption={t('sales.vehicle.title')}
          storageId="sales.vehicles"
          cardAvatar={false}
          cardLayout="stacked"
          page={{ page: 1, pageSize: Math.max(list.length, 1), total: list.length, totalPages: 1 }}
          onPageChange={() => undefined}
          footer={null}
          onRowOpen={(v) => router.push(vehicleHref(v.number))}
        />
      </UbStack>
    </UbPageShell>
  );
}
