import type { ReactNode } from 'react';

import { UbStack, UbText } from 'src/design-system';
import { formatInr, formatUnitPrice } from 'src/utils/money';

/** Internal counter-row presentation. Callers supply their existing engine's amounts. */
export function CounterLineSummary({
  name,
  quantity,
  unit,
  unitAmount,
  unitAmountPlaces = 2,
  total,
  discountType,
  discountValue,
  children,
}: Readonly<{
  name: string;
  quantity: string;
  unit: string;
  unitAmount: string;
  unitAmountPlaces?: 2 | 4;
  total: string;
  discountType?: string;
  discountValue?: string;
  children?: ReactNode;
}>): React.JSX.Element {
  return (
    <UbStack gap={1}>
      <UbText variant="body-sm-medium" className="break-words">
        {name}
      </UbText>
      <UbStack direction="row" justify="between" gap={2} wrap>
        <UbText variant="caption" tone="secondary" className="break-words">
          {quantity || '0'} {unit} × {formatUnitPrice(unitAmount || '0', unitAmountPlaces)}
          {discountType && discountValue
            ? ` · −${discountType === 'percent' ? `${discountValue}%` : formatInr(discountValue)}`
            : ''}
        </UbText>
        <UbText variant="body-sm-medium" className="ds-num break-words">
          {formatInr(total)}
        </UbText>
      </UbStack>
      {children}
    </UbStack>
  );
}
