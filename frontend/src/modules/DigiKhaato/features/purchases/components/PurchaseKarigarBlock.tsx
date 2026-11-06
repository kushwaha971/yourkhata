'use client';

import { useEffect, useState } from 'react';

import { UbLink, UbPanel, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';

import { listKarigars, type KarigarLot } from '../../sales/api/karigarService';

/**
 * Design D6, jeweller: gold back from a karigar, waiting for its tags. It only
 * reads the lots; receiving and tagging stay on Custom orders, so the stock and
 * wastage rules have one home and a purchase cannot post a lot twice.
 */
export function PurchaseKarigarBlock(): React.JSX.Element | null {
  const { t } = useTranslation();
  const [lots, setLots] = useState<readonly KarigarLot[]>([]);

  useEffect(() => {
    const abort = new AbortController();
    listKarigars(abort.signal)
      .then((data) => setLots(data.to_tag))
      .catch(() => undefined);
    return () => abort.abort();
  }, []);

  if (lots.length === 0) return null;
  return (
    <UbStack gap={3} data-testid="purchase-karigar">
      {lots.map((lot) => (
        <UbPanel key={lot.id}>
          <UbStack gap={2} className="p-4">
            <UbText variant="body-medium" className="font-semibold">
              {t('purchases.karigar.title', { name: lot.karigar.name })}
            </UbText>
            <UbStack direction="row" justify="between" gap={3}>
              <UbText variant="body-sm" tone="secondary">
                {t('purchases.karigar.issued')}
              </UbText>
              <UbText variant="body-sm" className="ds-num">
                {lot.issued_g} g
              </UbText>
            </UbStack>
            <UbStack direction="row" justify="between" gap={3}>
              <UbText variant="body-sm" tone="secondary">
                {t('purchases.karigar.received')}
              </UbText>
              <UbText variant="body-sm" className="ds-num">
                {lot.received_g ?? '—'} g
              </UbText>
            </UbStack>
            <UbLink href={`${ROUTES.SALES_CUSTOM_ORDERS}#karigars`} variant="body-sm-medium">
              {t('purchases.karigar.makeTags')}
            </UbLink>
          </UbStack>
        </UbPanel>
      ))}
    </UbStack>
  );
}
