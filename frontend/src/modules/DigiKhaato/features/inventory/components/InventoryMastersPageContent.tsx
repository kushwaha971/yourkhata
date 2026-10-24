'use client';

import { useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Lock, Plus } from 'lucide-react';

import {
  UbButton,
  UbChipTabs,
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
import { useTranslation } from 'src/hooks/useTranslation';

import { useInventoryMasters } from '../hooks/useInventoryMasters';
import { filterCategories, filterUnits, splitUnits } from '../view-model/mastersView';

import type { Category, Unit } from '../types/item.types';

const MasterFormDialog = dynamic(
  () => import('./MasterFormDialog').then((m) => m.MasterFormDialog),
  {
    ssr: false,
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

function CategoryRows({ rows }: Readonly<{ rows: readonly Category[] }>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <UbStack as="ul" gap={0} data-testid="category-list" className="-mx-4">
      {rows.map((parent, index) => (
        <UbStack as="li" key={parent.id} gap={0}>
          {index > 0 && <UbDivider />}
          <UbStack direction="row" gap={3} justify="between" align="center" className="px-4 py-3">
            <UbText variant="body-sm-medium" className="min-w-0 break-words">
              {parent.name}
            </UbText>
            <UbText variant="caption" tone="tertiary" className="ds-num shrink-0">
              {t('inventory.masters.itemCount', { count: parent.itemCount })}
            </UbText>
          </UbStack>
          {parent.children.map((child) => (
            <UbStack
              key={child.id}
              direction="row"
              gap={3}
              justify="between"
              align="center"
              className="py-2 pl-8 pr-4"
            >
              <UbText variant="body-sm" className="min-w-0 break-words">
                {child.name}
              </UbText>
              <UbText variant="caption" tone="tertiary" className="ds-num shrink-0">
                {t('inventory.masters.itemCount', { count: child.itemCount })}
              </UbText>
            </UbStack>
          ))}
        </UbStack>
      ))}
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
  const [adding, setAdding] = useState<Adding>(null);
  const [categoryQuery, setCategoryQuery] = useState('');
  const [unitQuery, setUnitQuery] = useState('');

  const categories = useMemo(
    () => filterCategories(masters.categories, categoryQuery),
    [masters.categories, categoryQuery]
  );
  const units = useMemo(
    () => splitUnits(filterUnits(masters.units, unitQuery)),
    [masters.units, unitQuery]
  );

  const categorySection = (
    <UbPanel
      data-testid="masters-categories"
      className={tab === 'categories' ? undefined : 'max-lg:hidden'}
    >
      <UbPanelSection
        title={t('inventory.masters.categories')}
        action={
          masters.canWrite ? (
            <AddButton
              label={t('inventory.masters.category.add')}
              testId="masters-add-category"
              onClick={() => setAdding({ kind: 'category', seed: '' })}
            />
          ) : undefined
        }
      >
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
            <UbSearchInput
              value={categoryQuery}
              onChange={setCategoryQuery}
              placeholder={t('inventory.masters.category.search')}
              aria-label={t('inventory.masters.category.search')}
            />
            {categories.length === 0 ? (
              <NoMatch
                query={categoryQuery}
                canWrite={masters.canWrite}
                addLabel={t('inventory.masters.category.addThis')}
                onAdd={() => setAdding({ kind: 'category', seed: categoryQuery.trim() })}
              />
            ) : (
              <CategoryRows rows={categories} />
            )}
          </>
        )}
      </UbPanelSection>
    </UbPanel>
  );

  const unitSection = (
    <UbPanel data-testid="masters-units" className={tab === 'units' ? undefined : 'max-lg:hidden'}>
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

  return (
    <UbPageShell>
      <UbPageHeader title={t('inventory.masters.title')} />
      {/* The layout is CSS, not a media query in JavaScript: the server cannot
          know the width, so a JS switch hydrated the phone layout on every
          desktop load and then rebuilt the page (measured +135 ms at 4x CPU).
          Below lg the chips pick one section; from lg both sit side by side
          and the chip row is hidden. */}
      <UbChipTabs<MasterTab>
        value={tab}
        onValueChange={setTab}
        ariaLabel={t('inventory.masters.title')}
        size="sm"
        listClassName="lg:hidden"
        panelClassName="pt-3 lg:pt-0"
        tabs={[
          { value: 'categories', label: t('inventory.masters.categories') },
          { value: 'units', label: t('inventory.masters.units') },
        ]}
      >
        <UbStack gap={4} className="lg:grid lg:grid-cols-2 lg:items-start">
          {categorySection}
          {unitSection}
        </UbStack>
      </UbChipTabs>
      {adding && (
        <MasterFormDialog kind={adding.kind} seed={adding.seed} onClose={() => setAdding(null)} />
      )}
    </UbPageShell>
  );
}
