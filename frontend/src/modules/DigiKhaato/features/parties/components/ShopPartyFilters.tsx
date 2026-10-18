'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';

import { SlidersHorizontal } from 'lucide-react';

import { UbButton } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';

import type { PartyListParams, PartyTagWithCount } from '../types/party.types';

const Drawer = dynamic(
  () => import('./ShopPartyFilterDrawer').then((m) => m.ShopPartyFilterDrawer),
  { ssr: false }
);

export function ShopPartyFilters({
  t,
  supplier = false,
  filters,
  tags,
  onApply,
}: Readonly<{
  t: TranslateFn;
  supplier?: boolean;
  filters: PartyListParams;
  tags: readonly PartyTagWithCount[];
  onApply: (next: Partial<PartyListParams>) => void;
}>): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const count = [
    filters.balance,
    filters.late,
    filters.collection,
    filters.tag,
    filters.status !== 'active',
    filters.role,
    filters.credit,
  ].filter(Boolean).length;
  return (
    <>
      <UbButton
        variant="outlineNeutral"
        className="h-10 max-sm:h-10 max-sm:w-10"
        iconOnly="mobile"
        icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count ? `${t('common.filters.title')} (${count})` : t('common.filters.title')}
        data-testid="filters-button"
      >
        {t('common.filters.title')}
      </UbButton>
      {open && (
        <Drawer
          supplier={supplier}
          filters={filters}
          tags={tags}
          onApply={onApply}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
