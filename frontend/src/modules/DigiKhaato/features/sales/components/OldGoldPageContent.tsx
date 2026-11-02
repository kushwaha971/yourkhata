'use client';

import { useEffect, useState } from 'react';

import {
  UbEmptyState,
  UbLink,
  UbPageHeader,
  UbPageShell,
  UbPageSkeleton,
  UbPanel,
  UbStack,
  UbText,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { PURITY_SHORT } from '../../inventory/constants/purity';
import { getOldGold, type OldGoldPage } from '../api/jewelService';

/**
 * G2's "its own old-gold stock": grams held by purity, then each lot taken in
 * with its bill. The design has no mock for this page, only the promise and the
 * menu entry; it uses the count line and rows of the other registers.
 */
export function OldGoldPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const [data, setData] = useState<OldGoldPage | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getOldGold(controller.signal)
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <UbPageShell>
      <UbPageHeader
        title={t('sales.oldGoldPage.title')}
        subtitle={t('sales.oldGoldPage.subtitle')}
      />
      {failed && (
        <UbEmptyState variant="error" title={t('sales.oldGoldPage.failed')} description="" />
      )}
      {!failed && !data && <UbPageSkeleton variant="list" />}
      {data && data.rows.length === 0 && (
        <UbEmptyState
          variant="firstUse"
          title={t('sales.oldGoldPage.empty')}
          description={t('sales.oldGoldPage.emptyBody')}
        />
      )}
      {data && data.rows.length > 0 && (
        <UbStack gap={3} data-testid="old-gold-page">
          <UbText
            variant="body-sm"
            tone="secondary"
            className="ds-num"
            data-testid="old-gold-stock"
          >
            {data.stock
              .map((row) => `${PURITY_SHORT[row.purity] ?? row.purity} ${row.weight_g} g`)
              .join(' · ')}
          </UbText>
          <UbStack gap={2}>
            {data.rows.map((row) => (
              <UbPanel key={row.id} className="p-4" data-testid="old-gold-row">
                <UbStack
                  direction="row"
                  justify="between"
                  align="start"
                  className="flex-wrap gap-2"
                >
                  <UbStack gap={0} className="min-w-0">
                    <UbText variant="body-sm-medium" className="ds-num">
                      {`${row.weight_g} g · ${PURITY_SHORT[row.purity] ?? row.purity}`}
                    </UbText>
                    <UbText variant="caption" tone="tertiary" className="break-words">
                      {[
                        formatBusinessDate(row.taken_on),
                        row.customer,
                        t('sales.oldGoldPage.less', { pct: Number(row.less_pct).toString() }),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </UbText>
                  </UbStack>
                  <UbStack gap={0} className="items-end">
                    <UbText variant="body-sm-medium" className="ds-num">
                      {formatInr(row.value)}
                    </UbText>
                    {row.bill_number && (
                      <UbLink href={`${ROUTES.SALES_INVOICES}/${row.bill_id}`} variant="caption">
                        {row.bill_number}
                      </UbLink>
                    )}
                  </UbStack>
                </UbStack>
              </UbPanel>
            ))}
          </UbStack>
        </UbStack>
      )}
    </UbPageShell>
  );
}
