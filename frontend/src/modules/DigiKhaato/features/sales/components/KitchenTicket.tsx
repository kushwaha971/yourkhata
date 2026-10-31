'use client';

import { useEffect, useState } from 'react';

import { ChefHat } from 'lucide-react';

import { UbBox, UbButton, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatTimestamp } from 'src/utils/dates';
import { trimQuantity } from 'src/utils/quantity';

import type { SalesDocument } from '../types/sales.types';

/**
 * D P6 — design D11's kitchen ticket: a second small print (58 mm) of what to
 * make, without prices: "2 × Cold coffee / + Ice cream". The button mounts
 * the ticket only while printing, so the bill's own print is untouched.
 */
export function KitchenTicketButton({ doc }: Readonly<{ doc: SalesDocument }>): React.JSX.Element {
  const { t } = useTranslation();
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    if (!printing) return undefined;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const id = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);
  return (
    <>
      <UbButton
        variant="secondary"
        icon={<ChefHat className="h-4 w-4" aria-hidden />}
        onClick={() => setPrinting(true)}
        data-testid="kitchen-ticket"
      >
        {t('sales.kitchen.print')}
      </UbButton>
      {printing && (
        <UbBox className="ub-print-only ub-print-kitchen hidden font-mono text-black" data-testid="kitchen-ticket-sheet">
          <UbText as="p" variant="inherit" className="text-[11pt] font-bold">
            {t('sales.kitchen.title', { token: doc.number ?? '' })}
          </UbText>
          <UbText as="p" variant="inherit" className="text-[9pt]">
            {formatTimestamp(doc.issuedAt ?? doc.createdAt)}
          </UbText>
          <UbBox className="my-1 border-t border-dashed border-black" />
          {doc.lines.map((line) => (
            <UbBox key={line.id ?? line.lineNo}>
              <UbText as="p" variant="inherit" className="text-[10pt]">
                {`${trimQuantity(line.qty)} × ${line.description}`}
              </UbText>
              {(line.addons ?? []).map((addon) => (
                <UbText key={addon.name} as="p" variant="inherit" className="pl-3 text-[10pt]">
                  {`+ ${addon.name}`}
                </UbText>
              ))}
            </UbBox>
          ))}
          <UbBox className="my-1 border-t border-dashed border-black" />
          <UbText as="p" variant="inherit" className="text-[9pt]">
            {t('sales.kitchen.footer', { number: doc.number ?? '' })}
          </UbText>
        </UbBox>
      )}
    </>
  );
}
