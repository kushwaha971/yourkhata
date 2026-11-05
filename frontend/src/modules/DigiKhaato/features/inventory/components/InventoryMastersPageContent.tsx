'use client';

import { useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Lock, Plus } from 'lucide-react';

import {
  UbButton,
  UbCountLine,
  UbDialogLoading,
  UbDivider,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbPanel,
  UbPanelSection,
  UbSearchInput,
  UbSkeleton,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useIsMobileLayer } from 'src/design-system/motion/useMediaQuery';
import { UbPageHeaderMobileActions } from 'src/design-system/UbPageHeader/UbPageHeaderMobileActions';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';

import { saveBlob } from '../../imports/api/fileDownload';
import { useInventoryMasters } from '../hooks/useInventoryMasters';
import { filterCategories, filterUnits, splitUnits, usualGstLabel } from '../view-model/mastersView';

import type { Category, Unit } from '../types/item.types';

const MasterFormDialog = dynamic(
  () => import('./MasterFormDialog').then((m) => m.MasterFormDialog),
  {
    ssr: false,
  loading: () => <UbDialogLoading />,
  }
);

type MasterTab = 'categories' | 'units';
type Adding = { readonly kind: 'category' | 'unit'; readonly seed: string } | null;

/** The section's "+ Add": the word on the button, the full action for a screen reader. */
function AddButton({
  label,
  onClick,
  testId,
}: Readonly<{ label: string; onClick: () => void; testId: string }>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <UbButton
      variant="secondary"
      size="sm"
      icon={<Plus className="h-4 w-4" aria-hidden />}
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
    >
      {t('inventory.masters.add')}
    </UbButton>
  );
}

/** Nothing matched: say so, and offer to make it (09 §8.5, find → add). */
function NoMatch({
  query,
  canWrite,
  addLabel,
  onAdd,
}: Readonly<{
  query: string;
  canWrite: boolean;
  /** The button names the kind, not the text: a typed name can be 60 characters. */
  addLabel: string;
  onAdd: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <UbStack gap={2} align="start" data-testid="masters-no-match">
      {/* A typed name can be one long word; it wraps rather than leaving the phone. */}
      <UbText variant="body-sm" tone="tertiary" className="w-full min-w-0 [overflow-wrap:anywhere]">
        {t('inventory.masters.noMatch', { query: query.trim() })}
      </UbText>
      {canWrite && (
        <UbButton
          variant="secondary"
          size="sm"
          icon={<Plus className="h-4 w-4" aria-hidden />}
          onClick={onAdd}
          data-testid="masters-add-named"
        >
          {addLabel}
        </UbButton>
      )}
    </UbStack>
  );
}

/** The design's columns (F-cat-d): Category, Items, Stock value, GST usually. */
const CATEGORY_GRID = 'lg:grid lg:grid-cols-[40fr_20fr_20fr_20fr] lg:items-center lg:gap-3';

function CategoryRows({ rows }: Readonly<{ rows: readonly Category[] }>): React.JSX.Element {
  const { t } = useTranslation();
  const flat = rows.flatMap((parent) => [
    { row: parent, child: false },
    ...parent.children.map((row) => ({ row, child: true })),
  ]);
  return (
    <UbStack as="ul" gap={0} data-testid="category-list">
      {flat.map(({ row, child }) => {
        const value = row.stockValue ? formatInr(row.stockValue) : null;
        const gst = usualGstLabel(row.taxCode, t);
        return (
          <UbStack
            as="li"
            key={row.id}
            direction="row"
            justify="between"
            align="center"
            className={`min-h-[62px] gap-3 border-b border-border-hairline py-3 pr-4 last:border-b-0 lg:min-h-[41px] lg:py-2 ${child ? 'pl-8' : 'pl-4'} ${CATEGORY_GRID}`}
          >
            <UbStack gap={0} className="min-w-0 flex-1">
              <UbText as="span" variant="body-sm" className="break-words">
                {row.name}
              </UbText>
              <UbText as="span" variant="caption" tone="tertiary" className="ds-num lg:hidden">
                {[String(row.itemCount), value].filter(Boolean).join(' · ')}
              </UbText>
            </UbStack>
            <UbText as="span" variant="body-sm" className="ds-num max-lg:hidden">
              {row.itemCount}
            </UbText>
            <UbText as="span" variant="body-sm" className="ds-num max-lg:hidden">
              {value ?? '—'}
            </UbText>
            <UbText as="span" variant="body-sm" className="ds-num shrink-0">
              {gst}
            </UbText>
          </UbStack>
        );
      })}
    </UbStack>
  );
}

function UnitRows({
  rows,
  testId,
}: Readonly<{ rows: readonly Unit[]; testId: string }>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <UbStack as="ul" gap={0} data-testid={testId} className="-mx-4">
      {rows.map((unit, index) => (
        <UbStack as="li" key={unit.id} gap={0}>
          {index > 0 && <UbDivider />}
          <UbStack direction="row" gap={3} justify="between" align="center" className="px-4 py-3">
            <UbStack gap={0} className="min-w-0">
              <UbText variant="body-sm-medium" className="ds-mono">
                {unit.code}
              </UbText>
              <UbText variant="caption" tone="tertiary" className="break-words">
                {unit.name} ·{' '}
                {unit.allowDecimal
                  ? t('inventory.masters.unit.decimalsOn')
                  : t('inventory.masters.unit.decimalsOff')}
              </UbText>
            </UbStack>
            {unit.isSystem && (
              <UbStatusBadge
                tone="neutral"
                icon={<Lock className="h-3 w-3" aria-hidden />}
                label={t('inventory.masters.unit.standard')}
                srLabel={t('inventory.masters.unit.locked')}
              />
            )}
          </UbStack>
        </UbStack>
      ))}
    </UbStack>
  );
}

/**
 * INV-04 / 09 §8.5 — the two short lists items depend on, laid out for "find
 * → add". Each section has its own search and its own + Add; a search that
 * finds nothing offers to add exactly what was typed. A phone switches between
 * the two with chips; a desktop shows them side by side. Units list the
 * standard GST codes first, locked, and the shop's own below. Create-only at
 * MVP, as the FRD says — there is no rename control to promise something that
 * is not built.
 */
export function InventoryMastersPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const masters = useInventoryMasters();
  const [tab, setTab] = useState<MasterTab>('categories');
  const isPhone = useIsMobileLayer();
  const [adding, setAdding] = useState<Adding>(null);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [unitQuery, setUnitQuery] = useState('');

  const categorySearch = (
    <UbSearchInput
      value={categoryQuery}
      onChange={setCategoryQuery}
      placeholder={t('inventory.masters.category.searchShort')}
      aria-label={t('inventory.masters.category.search')}
    />
  );
  const categoryCount = masters.categories.reduce((n, row) => n + 1 + row.children.length, 0);
  const exportCategories = () => {
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const head = (['name', 'items', 'value', 'gst'] as const).map((key) =>
      t(`inventory.masters.category.column.${key}`)
    );
    const body = masters.categories
      .flatMap((row) => [row, ...row.children])
      .map((row) => [row.name, String(row.itemCount), row.stockValue ?? '', usualGstLabel(row.taxCode, t)]);
    saveBlob(
      new Blob([[head, ...body].map((line) => line.map(cell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
      'categories.csv'
    );
  };

  const categories = useMemo(
    () => filterCategories(masters.categories, categoryQuery),
    [masters.categories, categoryQuery]
  );
  const units = useMemo(
    () => splitUnits(filterUnits(masters.units, unitQuery)),
    [masters.units, unitQuery]
  );

  const categorySection = (
    <UbStack gap={3} data-testid="masters-categories" className={tab === 'categories' ? undefined : 'hidden'}>
      {masters.categoriesLoading && masters.categories.length === 0 ? (
        <UbSkeleton variant="list" />
      ) : masters.categories.length === 0 ? (
        <UbEmptyState
          variant="firstUse"
          title={t('inventory.masters.category.empty.title')}
          description={t('inventory.masters.category.empty.body')}
        />
      ) : (
        <>
          {isPhone && categorySearch}
          <UbCountLine
            items={[
              {
                id: 'count',
                template: t('inventory.masters.category.count'),
                values: { count: { text: String(categoryCount) } },
              },
            ]}
          />
          <UbStack
            gap={0}
            data-ub-register-frame=""
            className="overflow-hidden rounded-card border border-border-hairline bg-surface-card"
          >
            {!isPhone && (
              <UbStack className="border-b border-border-hairline p-3">{categorySearch}</UbStack>
            )}
            <UbStack
              direction="row"
              className={`hidden bg-surface-sunken px-4 py-2 lg:grid ${CATEGORY_GRID}`}
              aria-hidden
            >
              {(['name', 'items', 'value', 'gst'] as const).map((key) => (
                <UbText as="span" key={key} variant="caption" tone="secondary" className="text-[13px] font-semibold">
                  {t(`inventory.masters.category.column.${key}`)}
                </UbText>
              ))}
            </UbStack>
            {categories.length === 0 ? (
              <UbStack className="p-4">
                <NoMatch
                  query={categoryQuery}
                  canWrite={masters.canWrite}
                  addLabel={t('inventory.masters.category.addThis')}
                  onAdd={() => setAdding({ kind: 'category', seed: categoryQuery.trim() })}
                />
              </UbStack>
            ) : (
              <CategoryRows rows={categories} />
            )}
          </UbStack>
        </>
      )}
    </UbStack>
  );

  const unitSection = (
    <UbPanel data-testid="masters-units" className={tab === 'units' ? undefined : 'hidden'}>
      <UbPanelSection
        title={t('inventory.masters.units')}
        action={
          masters.canWrite ? (
            <AddButton
              label={t('inventory.masters.unit.add')}
              testId="masters-add-unit"
              onClick={() => setAdding({ kind: 'unit', seed: '' })}
            />
          ) : undefined
        }
      >
        {masters.loading && masters.units.length === 0 ? (
          <UbSkeleton variant="list" />
        ) : (
          <>
            <UbSearchInput
              value={unitQuery}
              onChange={setUnitQuery}
              placeholder={t('inventory.masters.unit.search')}
              aria-label={t('inventory.masters.unit.search')}
            />
            {units.standard.length + units.own.length === 0 ? (
              <NoMatch
                query={unitQuery}
                canWrite={masters.canWrite}
                addLabel={t('inventory.masters.unit.addThis')}
                onAdd={() => setAdding({ kind: 'unit', seed: unitQuery.trim() })}
              />
            ) : (
              <UbStack gap={3}>
                {units.standard.length > 0 && (
                  <UbStack gap={1}>
                    <UbText variant="label" tone="secondary">
                      {t('inventory.masters.unit.standardGroup')}
                    </UbText>
                    <UnitRows rows={units.standard} testId="unit-list-standard" />
                  </UbStack>
                )}
                <UbStack gap={1} data-testid="unit-group-own">
                  <UbText variant="label" tone="secondary">
                    {t('inventory.masters.unit.ownGroup')}
                  </UbText>
                  {units.own.length > 0 ? (
                    <UnitRows rows={units.own} testId="unit-list-own" />
                  ) : (
                    <UbText variant="body-sm" tone="tertiary">
                      {t('inventory.masters.unit.ownEmpty')}
                    </UbText>
                  )}
                </UbStack>
              </UbStack>
            )}
          </>
        )}
      </UbPanelSection>
    </UbPanel>
  );

  const onCategories = tab === 'categories';
  return (
    <UbPageShell>
      <UbPageHeader
        title={t(onCategories ? 'inventory.masters.categories' : 'inventory.masters.units')}
        subtitle={onCategories ? t('inventory.masters.category.subtitle') : undefined}
        actions={
          <>
            {onCategories && masters.categories.length > 0 && (
              <UbButton variant="secondary" onClick={exportCategories}>
                {t('inventory.masters.export')}
              </UbButton>
            )}
            {/* Units have no screen in the design; they are one button away. */}
            <UbButton
              variant="secondary"
              data-testid="masters-switch"
              onClick={() => setTab(onCategories ? 'units' : 'categories')}
            >
              {t(onCategories ? 'inventory.masters.units' : 'inventory.masters.categories')}
            </UbButton>
          </>
        }
        primaryAction={
          onCategories && masters.canWrite ? (
            <UbButton
              data-testid="masters-add-category"
              onClick={() => setAdding({ kind: 'category', seed: '' })}
            >
              {t('inventory.masters.category.add')}
            </UbButton>
          ) : undefined
        }
        renderMobileActions={(actions) => (
            <UbPageHeaderMobileActions
              actions={actions}
              mobile={{
                menuLabel: t('common.action.moreActions'),
                closeLabel: t('common.action.close'),
                primaryPlacement: 'header',
                primary:
                  onCategories && masters.canWrite
                    ? {
                        label: t('inventory.masters.category.add'),
                        icon: <Plus className="h-6 w-6" aria-hidden />,
                        onClick: () => setAdding({ kind: 'category', seed: '' }),
                      }
                    : undefined,
              }}
            />
          )
        }
      />
      <UbStack gap={4}>
        {categorySection}
        {unitSection}
      </UbStack>
      {adding && (
        <MasterFormDialog kind={adding.kind} seed={adding.seed} onClose={() => setAdding(null)} />
      )}
    </UbPageShell>
  );
}
