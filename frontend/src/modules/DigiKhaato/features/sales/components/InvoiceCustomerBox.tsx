'use client';

import { UbAvatar, UbBox, UbButton, UbSkeleton, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { formatInr } from 'src/utils/money';
import { formatPhoneForDisplay } from 'src/utils/share';

/**
 * The saved customer on a new bill (A3, FB-013). Design §A3 `.cbox`:
 *
 *   [av] Name ………………………………… Change
 *        +91 98765 43210        ₹1,240 to collect
 *
 * A 36 px avatar spanning both lines, then two columns: the name owns the
 * first and is cut with "…", Change sits at its end; the mobile, then the
 * balance right-aligned in the same column as Change, tabular digits, in the
 * money colour. Before it the amount floated in the middle, "Nothing due in
 * Shop" sat under it on the left and Change had its own line.
 *
 * `balance` is the SHOP balance — `party.shop.customerBalance`, due minus
 * credit — never `summary.balance`, which is the party's main (Udhaar) book.
 * A Shop bill printed "Advance in Shop ₹27,983.54" for a customer the Shop
 * owes nothing (found by reading the box back from the API, A3). `undefined`
 * is "still loading" and keeps the line's height; `null` is "the server has
 * no Shop figures for this person", which is nothing due.
 */
export function InvoiceCustomerBox({
  name,
  mobile,
  balance,
  onChange,
  disabled,
  t,
}: Readonly<{
  name: string;
  mobile: string | null | undefined;
  balance: string | null | undefined;
  onChange: () => void;
  disabled: boolean;
  t: TranslateFn;
}>): React.JSX.Element {
  const value = balance == null ? 0 : Number(balance);
  const figure =
    balance === undefined
      ? null
      : value > 0
        ? {
            text: t('sales.editor.box.toCollect', { amount: formatInr(balance ?? '0') }),
            tone: 'text-get',
          }
        : value < 0
          ? {
              text: t('sales.editor.box.youOwe', { amount: formatInr(String(-value)) }),
              tone: 'text-give',
            }
          : { text: t('sales.editor.box.nothingDue'), tone: 'text-text-tertiary' };
  return (
    <UbBox
      data-testid="invoice-customer-line"
      className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 rounded-[10px] border border-border-hairline px-3.5 py-3"
    >
      <UbAvatar name={name} className="row-span-2 h-9 w-9" />
      {/* Each line is its own row, so the name gives way only to Change. In
          the drawing's single grid the right column is as wide as the widest
          figure, and "₹7,203.70 to collect" on line 2 cut "Sharma Mart 45" on
          line 1 at 390 px with room to spare. Short names look identical. */}
      <UbBox className="flex min-w-0 items-center justify-between gap-3">
        <UbText
          data-part="name"
          variant="body-medium"
          className="min-w-0 truncate text-[0.9375rem] font-semibold text-text-primary"
        >
          {name}
        </UbText>
        <UbButton
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onChange}
          className="ub-hit h-auto shrink-0 px-0 py-0 text-[0.875rem] font-semibold text-text-accent hover:bg-transparent"
        >
          {t('sales.editor.changeCustomer')}
        </UbButton>
      </UbBox>
      {/* Line 2 wraps rather than cutting the mobile: a phone number with
          digits missing ("+91 90000 000…" at 390 px beside a five-figure
          balance) is no number at all. The balance then takes the right of
          its own line; a short balance keeps the drawn two lines. */}
      <UbBox className="flex min-w-0 flex-wrap items-center justify-between gap-x-3">
        {balance === undefined ? (
          // The mobile comes in the same reply as the balance: hold its place
          // too, or line 2 wraps one way while loading and another after.
          <UbSkeleton variant="text" className="h-5 w-[6.75rem]" />
        ) : (
          <UbText
            data-part="mobile"
            variant="caption"
            tone="tertiary"
            className="whitespace-nowrap text-[0.8125rem] leading-5"
          >
            {mobile ? formatPhoneForDisplay(mobile) : ''}
          </UbText>
        )}
        {figure ? (
          <UbText
            data-part="balance"
            variant="caption"
            className={`ml-auto shrink-0 whitespace-nowrap text-[0.8125rem] font-semibold tabular-nums leading-5 ${figure.tone}`}
          >
            {figure.text}
          </UbText>
        ) : (
          // Same 20 px tall as the line it stands in for, and about as wide as a
          // typical figure, so line 2 wraps the same way before and after the
          // number arrives (measured 65 → 68 and 69 → 89 px jumps, A3).
          <UbSkeleton variant="text" className="ml-auto h-5 w-[7.75rem] shrink-0" />
        )}
      </UbBox>
    </UbBox>
  );
}
