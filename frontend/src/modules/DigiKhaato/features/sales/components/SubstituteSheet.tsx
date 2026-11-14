'use client';

import { useEffect, useState } from 'react';

import { Plus } from 'lucide-react';

import { UbButton, UbDialog, UbRadioGroup, UbStack, UbText } from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { formatInr } from 'src/utils/money';
import { formatQuantity } from 'src/utils/quantity';

import {
  addToShortBook,
  getSubstitutes,
  type Substitute,
} from 'modules/DigiKhaato/features/inventory/api/shortBookService';
import type { ItemListRow } from 'modules/DigiKhaato/features/inventory/types/item.types';

/**
 * G4 (design pSubst) — a medicine picked on a bill is out of stock: offer the
 * medicines with the same salt, in stock first, then cheapest, with the first
 * one chosen. "Use …" bills the substitute; the short book line writes the
 * missing medicine down for the distributor; "Bill … anyway" keeps the pick,
 * because the shop decides whether stock may go below zero, not this sheet.
 */
export function SubstituteSheet({
  item,
  onUse,
  onAnyway,
  onClose,
}: Readonly<{
  item: ItemListRow;
  onUse: (row: ItemListRow) => void;
  onAnyway: () => void;
  onClose: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [options, setOptions] = useState<readonly Substitute[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [noted, setNoted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getSubstitutes(item.id, controller.signal)
      .then((rows) => {
        setOptions(rows);
        setChosen(rows.find((row) => row.inStock)?.row.id ?? null);
      })
      .catch(() => setOptions([]));
    return () => controller.abort();
  }, [item.id]);

  const picked = options?.find((option) => option.row.id === chosen) ?? null;
  const noteIt = () => {
    void addToShortBook(item.id, 'asked').then(() => {
      setNoted(true);
      dispatch(showSnackbar({ severity: 'success', id: 'sales.subst.added', params: { name: item.name } }));
    });
  };

  return (
    <UbDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('sales.subst.title', { name: item.name })}
      closeLabel={t('common.action.close')}
      footer={
        /* The design's footer (pSubst): Cancel and Use …; a long medicine name
           wraps inside its button instead of running off a 390 px phone. */
        <UbStack
          direction="row"
          gap={2}
          className="w-full [&>*]:h-auto [&>*]:min-h-[46px] [&>*]:flex-1 [&>*]:whitespace-normal"
        >
          <UbButton variant="secondary" size="lg" onClick={onClose}>
            {t('common.action.cancel')}
          </UbButton>
          {picked && (
            <UbButton size="lg" onClick={() => onUse(picked.row)} data-testid="subst-use">
              {t('sales.subst.use', { name: picked.row.name })}
            </UbButton>
          )}
        </UbStack>
      }
    >
      <UbStack gap={3} data-testid="subst-sheet">
        <UbText variant="caption" tone="tertiary">
          {options && options.length === 0
            ? t('sales.subst.none')
            : t('sales.subst.caption', { salt: item.salt ?? '' })}
        </UbText>
        {options && options.length > 0 && (
          <UbRadioGroup<string>
            name="substitute"
            variant="list"
            value={chosen}
            onChange={setChosen}
            ariaLabel={t('sales.subst.caption', { salt: item.salt ?? '' })}
            options={options.map((option) => ({
              value: option.row.id,
              disabled: !option.inStock,
              label: (
                <UbStack direction="row" justify="between" align="center" className="w-full gap-3">
                  <UbText as="span" variant="body-sm-medium" className="min-w-0 break-words">
                    {option.row.name}
                  </UbText>
                  <UbText as="span" variant="body-sm" className="ds-num shrink-0 font-semibold">
                    {formatInr(option.row.sellingPrice)}
                  </UbText>
                </UbStack>
              ),
              hint: option.inStock
                ? t('sales.subst.stock', {
                    qty: `${formatQuantity(option.row.onHand ?? '0')} ${option.row.unit.code}`,
                  })
                : t('sales.subst.out'),
            }))}
          />
        )}
        <UbButton
          variant="secondary"
          size="lg"
          className="w-full"
          icon={<Plus className="h-4 w-4" aria-hidden />}
          onClick={noteIt}
          disabled={noted}
          data-testid="subst-short-book"
        >
          {noted ? t('sales.subst.added', { name: item.name }) : t('sales.subst.shortBook', { name: item.name })}
        </UbButton>
        {/* Whether stock may go below zero is the shop's rule, not this sheet's. */}
        <UbButton variant="ghost" className="w-full whitespace-normal" onClick={onAnyway} data-testid="subst-anyway">
          {t('sales.subst.anyway', { name: item.name })}
        </UbButton>
      </UbStack>
    </UbDialog>
  );
}
