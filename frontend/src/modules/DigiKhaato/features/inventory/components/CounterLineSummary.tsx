import type { ReactNode } from 'react';

import { UbStack, UbText } from 'src/design-system';
import { formatInr } from 'src/utils/money';

/** Internal counter-row presentation. Callers supply their existing engine's amounts. */
export function CounterLineSummary({
  name,
  quantity,
  unit,
  unitAmount,
  total,
  discountType,
  discountValue,
  children,
}: Readonly<{
  name: string;
  quantity: string;
  unit: string;
  unitAmount: string;
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
          {quantity || '0'} {unit} × {formatInr(unitAmount || '0')}
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
