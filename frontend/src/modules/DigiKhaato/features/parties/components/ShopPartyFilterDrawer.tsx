'use client';

import { useState } from 'react';

import { CompactDrawer } from 'src/components/records/CompactOverlays';
import { UbButton, UbChoiceChips, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { usePartyFilterCount } from '../hooks/usePartyFilterCount';
import { SHOP_SORT_CHOICES, SUPPLIER_SORT_CHOICES } from '../view-model/partyListSort';

import { PartyTagFilter } from './PartyTagFilter';

import type { PartyListParams, PartyTagWithCount } from '../types/party.types';

import 'src/i18n/catalogues/parties';

/** A filter is a draft. Closing never applies it; Reset edits the draft only. */
export function ShopPartyFilterDrawer({
  filters,
  supplier = false,
  tags,
  onApply,
  onClose,
}: Readonly<{
  filters: PartyListParams;
  supplier?: boolean;
  tags: readonly PartyTagWithCount[];
  onApply: (next: Partial<PartyListParams>) => void;
  onClose: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(filters);
  const total = usePartyFilterCount(draft);
  return (
    <CompactDrawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t(supplier ? 'parties.list.supplier.filters' : 'parties.list.shop.filters')}
      closeLabel={t('common.action.close')}
      className="lg:w-[360px] [&>div:last-child>button:last-child]:flex-1 [&>div:last-child]:flex-row [&>div:last-child]:gap-3"
      footer={
        <>
          <UbButton
            variant="ghost"
            onClick={() =>
              setDraft({
                ...filters,
                status: 'active',
                balance: '',
                late: '',
                collection: '',
                tag: '',
                role: '',
                credit: '',
                ordering: 'oldest_due_on',
              })
            }
          >
            {t('common.action.reset')}
          </UbButton>
          <UbButton
            data-testid="filters-apply"
            onClick={() => {
              onApply({
                status: draft.status,
                balance: draft.balance,
                late: draft.late,
                collection: draft.collection,
                tag: draft.tag,
                role: draft.role,
                credit: draft.credit,
                ordering: draft.ordering,
              });
              onClose();
            }}
          >
            {total === null
              ? t(supplier ? 'parties.list.supplier.show' : 'parties.list.shop.show')
              : t(supplier ? 'parties.list.supplier.showCount' : 'parties.list.shop.showCount', {
                  count: total,
                })}
          </UbButton>
        </>
      }
    >
      <UbStack gap={4}>
        <UbText variant="body-sm-medium">{t('parties.list.filter.balance.label')}</UbText>
        <UbChoiceChips
          ariaLabel={t('parties.list.filter.balance.label')}
          value={draft.balance}
          onChange={(balance) => setDraft({ ...draft, balance })}
          options={[
            { value: '', label: t('parties.list.filter.any') },
            {
              value: supplier ? 'i_owe' : 'owes_me',
              label: t(supplier ? 'parties.list.supplier.owes' : 'parties.list.shop.owes'),
            },
            {
              value: supplier ? 'owes_me' : 'i_owe',
              label: t(supplier ? 'parties.list.supplier.advance' : 'parties.list.shop.credit'),
            },
            { value: 'settled', label: t('parties.list.balance.settled') },
          ]}
        />
        <UbStack gap={2}>
          <UbText variant="body-sm-medium">{t('parties.list.shop.lateBy')}</UbText>
          <UbChoiceChips
            ariaLabel={t('parties.list.shop.lateBy')}
            value={draft.late ?? ''}
            onChange={(late) => setDraft({ ...draft, late })}
            options={[
              { value: '', label: t('parties.list.filter.any') },
              { value: 'not_due', label: t('parties.list.shop.notDue') },
              { value: '1_30', label: t('parties.list.shop.late1to30') },
              { value: 'over_30', label: t('parties.list.shop.lateOver30') },
            ]}
          />
        </UbStack>
        <UbStack gap={2}>
          <UbText variant="body-sm-medium">{t('parties.tags.filter.label')}</UbText>
          <PartyTagFilter
            t={t}
            value={draft.tag}
            tags={tags}
            onChange={(tag) => setDraft({ ...draft, tag })}
          />
        </UbStack>
        <UbText variant="body-sm-medium">{t('parties.list.column.status')}</UbText>
        <UbChoiceChips
          ariaLabel={t('parties.list.column.status')}
          value={draft.status}
          onChange={(status) => setDraft({ ...draft, status })}
          options={[
            { value: 'active', label: t('parties.list.status.active') },
            { value: 'archived', label: t('parties.list.status.archived') },
          ]}
        />
        {!supplier && (
          <UbStack gap={2}>
            <UbText variant="body-sm-medium">{t('parties.list.shop.collectionDate')}</UbText>
            <UbChoiceChips
              ariaLabel={t('parties.list.shop.collectionDate')}
              value={draft.collection}
              onChange={(collection) => setDraft({ ...draft, collection })}
              options={[
                { value: '', label: t('parties.list.filter.any') },
                { value: 'today', label: t('parties.list.filter.collection.today') },
                { value: 'overdue', label: t('parties.list.filter.collection.overdue') },
                { value: 'upcoming', label: t('parties.list.filter.collection.upcoming') },
              ]}
            />
          </UbStack>
        )}
        <UbStack gap={2}>
          <UbText variant="body-sm-medium">{t('parties.list.sort.label')}</UbText>
          <UbChoiceChips
            ariaLabel={t('parties.list.sort.label')}
            value={draft.ordering}
            onChange={(ordering) => setDraft({ ...draft, ordering })}
            options={(supplier ? SUPPLIER_SORT_CHOICES : SHOP_SORT_CHOICES).map((choice) => ({
              value: choice.ordering,
              label: t(choice.labelKey),
            }))}
          />
        </UbStack>
        <UbText variant="caption" tone="tertiary">
          {t(supplier ? 'parties.list.supplier.draft' : 'parties.list.shop.draft')}
        </UbText>
      </UbStack>
    </CompactDrawer>
  );
}
