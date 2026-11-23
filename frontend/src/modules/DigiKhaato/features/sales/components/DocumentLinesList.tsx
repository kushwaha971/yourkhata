'use client';

import { UbAmount, UbInfoRow, UbPanel, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';

import { documentTotalRows, trimQty } from './print/printModel';

import type { SalesDocument } from '../types/sales.types';

/** Phone reading view over the same stored lines and totals used on paper. */
export function DocumentLinesList({ doc }: Readonly<{ doc: SalesDocument }>): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <UbPanel className="ub-print-hide xl:hidden" aria-label={t('billDetail.items')}>
      <UbStack role="table" aria-label={t('billDetail.items')}>
        <UbText role="caption" variant="body-sm" className="p-4 font-semibold">
          {t('billDetail.items')}
        </UbText>
        <UbStack role="rowgroup">
          {doc.lines.map((line) => (
            <UbStack
              key={line.id ?? line.lineNo}
              role="row"
              gap={2}
              className="border-t border-border-hairline p-4"
            >
              <UbText role="rowheader" className="break-words font-medium">
                {line.description}
              </UbText>
              <UbStack direction="row" justify="between" gap={3}>
                <UbText
                  role="cell"
                  variant="body-sm"
                  tone="secondary"
                  className="min-w-0 break-words"
                >
                  {trimQty(line.qty)} {line.unitCode} × {formatInr(line.unitPrice)}
                </UbText>
                <UbStack role="cell">
                  <UbAmount value={line.lineTotal} size="sm" />
                </UbStack>
              </UbStack>
              {line.discountAmount !== '0.00' && (
                <UbText role="cell" variant="caption" tone="secondary">
                  {t('sales.totals.discount')} {formatInr(line.discountAmount)}
                </UbText>
              )}
            </UbStack>
          ))}
        </UbStack>
      </UbStack>
      <UbStack gap={2} className="p-4">
        {documentTotalRows(doc, t).map(([label, value]) => (
          <UbInfoRow key={label} label={label} value={value} />
        ))}
        <UbInfoRow
          label={t('sales.totals.grand')}
          value={<UbAmount value={doc.grandTotal} size="md" />}
          variant="total"
        />
      </UbStack>
      {(doc.notes || doc.terms) && (
        <UbStack gap={2} className="p-4">
          {doc.notes && (
            <UbText className="whitespace-pre-wrap break-words" variant="body-sm">
              {doc.notes}
            </UbText>
          )}
          {doc.terms && (
            <UbText className="whitespace-pre-wrap break-words" variant="body-sm" tone="secondary">
              {doc.terms}
            </UbText>
          )}
        </UbStack>
      )}
    </UbPanel>
  );
}
