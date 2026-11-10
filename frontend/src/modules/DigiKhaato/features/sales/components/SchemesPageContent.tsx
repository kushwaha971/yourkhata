'use client';

import { useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

import {
  UbButton,
  UbCard,
  UbChoiceChips,
  UbDialog,
  UbDrawerLoading,
  UbPageHeader,
  UbPageShell,
  UbSearchInput,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useIsMobileLayer } from 'src/design-system/motion/useMediaQuery';
import {
  UbDataGrid,
  useGridTier,
  type UbDataGridColumn,
  type UbGridState,
  type UbGridTier,
} from 'src/design-system/UbDataGrid';
import { UbPageHeaderMobileActions } from 'src/design-system/UbPageHeader/UbPageHeaderMobileActions';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { inventoryGridLabels } from 'modules/DigiKhaato/features/inventory/view-model/gridLabels';

import { listSchemes, setSchemeActive, type SchemeList, type SchemeRow } from '../api/schemeService';

import { schemeRuleText } from './SchemeFreeLines';

const SchemeDrawer = dynamic(() => import('./SchemeDrawer').then((m) => m.SchemeDrawer), {
  ssr: false,
  loading: () => <UbDrawerLoading />,
});

type Show = 'running' | 'all';

/** "18 cases free" or "₹4,820 off". */
const given = (s: SchemeRow, t: TranslateFn): string =>
  s.rule === 'free'
    ? t('sales.scheme.givenFree', { qty: String(Number(s.free_given)), unit: s.item?.unit ?? '' })
    : t('sales.scheme.givenOff', { amount: formatInr(s.off_given) });

const statusBadge = (s: SchemeRow, t: TranslateFn): React.ReactNode => (
  <UbStatusBadge
    tone={s.status === 'running' ? 'success' : s.status === 'waiting' ? 'warning' : 'neutral'}
    label={t(`sales.scheme.status.${s.status}`)}
  />
);

const ruleWithItem = (s: SchemeRow, t: TranslateFn): string =>
  [schemeRuleText(s, t), s.item?.name].filter(Boolean).join(' · ');

const createColumns = (t: TranslateFn, tier: UbGridTier): UbDataGridColumn<SchemeRow>[] => {
  if (tier === 'cards')
    return [
      { id: 'code', header: t('sales.scheme.col.scheme'), priority: 1, cardSlot: 'title', cell: (s) => `${s.code} · ${s.company}` },
      {
        id: 'meta',
        header: t('sales.scheme.col.rule'),
        priority: 1,
        cardSlot: 'meta',
        cell: (s) => `${ruleWithItem(s, t)} · ${t('sales.scheme.till', { date: formatBusinessDate(s.valid_till) })} · ${given(s, t)}`,
      },
      { id: 'claim', header: t('sales.scheme.col.claim'), priority: 1, cardSlot: 'trailing', cell: (s) => t('sales.scheme.toClaim', { amount: formatInr(s.claim) }) },
    ];
  return [
    { id: 'code', header: t('sales.scheme.col.scheme'), priority: 1, cardSlot: 'none', widthShare: 11, cell: (s) => s.code },
    { id: 'company', header: t('sales.scheme.col.company'), priority: 1, cardSlot: 'none', widthShare: 15, cell: (s) => s.company },
    { id: 'rule', header: t('sales.scheme.col.rule'), priority: 1, cardSlot: 'none', widthShare: 21, cell: (s) => ruleWithItem(s, t) },
    { id: 'till', header: t('sales.scheme.col.till'), priority: 2, cardSlot: 'none', widthShare: 11, cell: (s) => formatBusinessDate(s.valid_till) },
    { id: 'status', header: t('sales.scheme.col.status'), priority: 2, cardSlot: 'none', widthShare: 10, cell: (s) => statusBadge(s, t) },
    { id: 'given', header: t('sales.scheme.col.given'), priority: 2, cardSlot: 'none', widthShare: 13, cell: (s) => given(s, t) },
    { id: 'claim', header: t('sales.scheme.col.claim'), priority: 1, cardSlot: 'none', align: 'end', widthShare: 19, cell: (s) => t('sales.scheme.toClaim', { amount: formatInr(s.claim) }) },
  ];
};

/** G9 — `/sales/schemes` (design dSchemes): companies' offers, and what to claim back. */
export function SchemesPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const tier = useGridTier();
  const isPhone = useIsMobileLayer();
  const { can } = usePermissions();
  const canWrite = can('sales.invoice.write');
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 300);
  const [show, setShow] = useState<Show>('running');
  const [list, setList] = useState<SchemeList | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  const [claims, setClaims] = useState(false);
  const [open, setOpen] = useState<SchemeRow | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listSchemes(q, controller.signal)
      .then((next) => {
        setList(next);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [q, attempt]);

  const columns = useMemo(() => createColumns(t, tier), [t, tier]);
  const rows = (list?.schemes ?? []).filter((s) => show === 'all' || s.status === 'running' || s.status === 'waiting');
  const gridState: UbGridState = failed
    ? 'error'
    : !list
      ? 'loading'
      : rows.length === 0
        ? search || (show === 'running' && (list?.schemes.length ?? 0) > 0)
          ? 'filtered-empty'
          : 'empty'
        : 'rows';
  const tools = (
    <UbStack direction="row" gap={2} className="flex-wrap items-center">
      <UbSearchInput value={search} onChange={setSearch} placeholder={t('sales.scheme.search')} aria-label={t('sales.scheme.search')} />
      <UbChoiceChips<Show>
        value={show}
        onChange={setShow}
        ariaLabel={t('sales.scheme.col.status')}
        options={[
          { value: 'running', label: t('sales.scheme.showRunning') },
          { value: 'all', label: t('sales.scheme.showAll') },
        ]}
      />
    </UbStack>
  );
  const newButton = canWrite && (
    <UbButton icon={<Plus className="h-4 w-4" aria-hidden />} iconOnly="mobile" onClick={() => setAdding(true)} data-testid="scheme-new">
      {t('sales.scheme.new')}
    </UbButton>
  );
  const claimsButton = (
    <UbButton variant="secondary" onClick={() => setClaims(true)} data-testid="scheme-claims">
      {t('sales.scheme.claims')}
    </UbButton>
  );
  const toggle = async (scheme: SchemeRow) => {
    await setSchemeActive(scheme.id, !scheme.active);
    setOpen(null);
    setAttempt((n) => n + 1);
  };

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('sales.scheme.title')}
        subtitle={isPhone ? undefined : t('sales.scheme.subtitle')}
        actions={isPhone ? undefined : claimsButton}
        primaryAction={newButton || undefined}
        renderMobileActions={() => (
          <UbPageHeaderMobileActions
            mobile={{
              menuLabel: t('common.action.moreActions'),
              closeLabel: t('common.action.close'),
              primaryPlacement: 'header',
              primary: canWrite
                ? { label: t('sales.scheme.new'), icon: <Plus className="h-6 w-6" aria-hidden />, onClick: () => setAdding(true) }
                : undefined,
            }}
          />
        )}
      />
      <UbStack gap={3} data-testid="schemes-screen">
        {isPhone && (
          <>
            {tools}
            {claimsButton}
          </>
        )}
        <UbDataGrid
          variant="register"
          toolbar={isPhone ? undefined : tools}
          rows={rows}
          columns={columns}
          rowId={(s) => s.id}
          rowName={(s) => s.code}
          state={gridState}
          labels={inventoryGridLabels(t, {
            loading: 'sales.scheme.loading',
            open: 'sales.scheme.open',
            selectAll: 'sales.scheme.title',
            selectRow: 'sales.scheme.title',
          })}
          emptyStates={{
            firstUse: { title: t('sales.scheme.empty.title'), description: t('sales.scheme.empty.body'), action: newButton || undefined },
            filtered: { title: t('sales.scheme.noMatch'), description: '' },
            error: {
              title: t('sales.scheme.error'),
              description: '',
              action: (
                <UbButton variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                  {t('common.action.retry')}
                </UbButton>
              ),
            },
          }}
          caption={t('sales.scheme.title')}
          storageId="sales.schemes"
          cardAvatar={false}
          cardLayout="stacked"
          page={{ page: 1, pageSize: Math.max(rows.length, 1), total: rows.length, totalPages: 1 }}
          onPageChange={() => undefined}
          footer={null}
          onRowOpen={(s) => setOpen(s)}
        />
        <UbCard>
          <UbText variant="body-sm" tone="secondary">{t('sales.scheme.note')}</UbText>
        </UbCard>
      </UbStack>
      {claims && list && (
        <UbDialog open onOpenChange={(next) => !next && setClaims(false)} title={t('sales.scheme.claimsTitle')} closeLabel={t('common.action.close')}>
          <UbStack gap={3} data-testid="scheme-claims-list">
            {list.claims.length === 0 && <UbText tone="secondary">{t('sales.scheme.noClaims')}</UbText>}
            {list.claims.map((row) => (
              <UbStack key={row.company} direction="row" gap={2} className="items-center justify-between">
                <UbText variant="body-sm" className="font-semibold">{row.company}</UbText>
                <UbText variant="body-sm" className="font-semibold">{formatInr(row.claim)}</UbText>
              </UbStack>
            ))}
            <UbText variant="caption" tone="secondary">{t('sales.scheme.claimsNote')}</UbText>
          </UbStack>
        </UbDialog>
      )}
      {open && (
        <UbDialog open onOpenChange={(next) => !next && setOpen(null)} title={`${open.code} · ${open.company}`} closeLabel={t('common.action.close')}>
          <UbStack gap={3} data-testid="scheme-sheet">
            <UbText variant="body-sm">{ruleWithItem(open, t)}</UbText>
            <UbText variant="body-sm" tone="secondary">
              {t('sales.scheme.fromTill', { from: formatBusinessDate(open.valid_from), till: formatBusinessDate(open.valid_till) })}
            </UbText>
            <UbText variant="body-sm" tone="secondary">
              {given(open, t)} · {t('sales.scheme.toClaim', { amount: formatInr(open.claim) })}
            </UbText>
            {canWrite && (
              <UbButton variant="secondary" onClick={() => void toggle(open)} data-testid="scheme-toggle">
                {open.active ? t('sales.scheme.stop') : t('sales.scheme.restart')}
              </UbButton>
            )}
          </UbStack>
        </UbDialog>
      )}
      {adding && (
        <SchemeDrawer
          onClose={() => setAdding(false)}
          onSaved={(scheme) => {
            setAdding(false);
            dispatch(showSnackbar({ severity: 'success', id: 'sales.scheme.saved', params: { code: scheme.code } }));
            setAttempt((n) => n + 1);
          }}
        />
      )}
    </UbPageShell>
  );
}
