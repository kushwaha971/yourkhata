'use client';

import { memo } from 'react';

import { UbAmount, UbBox, UbButton, UbStatusBadge, UbTagList, UbText } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';
import { compareMoney } from 'src/utils/money';

import { balanceView } from '../view-model/partyDisplay';
import { toTagListItems } from '../view-model/partyTagDisplay';

import type { Party, PartyTag } from '../types/party.types';

/**
 * What a party row is MADE OF: the five cells, memoised, each taking exactly
 * the strings it paints and deriving nothing it was not given.
 *
 * ── Why this file changed shape ─────────────────────────────────────────────
 * It used to be one `<li>` that hard-coded the phone layout — avatar, two-line
 * text, amount — and the desktop table would have been a second, separate copy
 * of the same five facts. `UbDataGrid` renders one column model three ways, so
 * the row's LAYOUT now belongs to the grid and only its CELLS belong here.
 *
 * They stay components rather than inline JSX in the column factory for the
 * reason §19.9.4 gives: a cell is the thing that repeats 25 to 100 times, and
 * `memo` on it is the cheapest re-render insurance in the file.
 *
 * No cell calls `useTranslation`. Translated copy arrives as a prop, so a
 * memoised cell never has to subscribe to the intl context and a column array
 * memoised on `t` invalidates exactly when the locale changes.
 */

export interface PartyNameCellProps {
  readonly name: string;
  readonly wrap?: boolean;
  readonly contact?: string;
  readonly statusLabel?: string;
  readonly roleLabel?: string;
  /** PTY-05. Empty for an untagged party, which is most of them. */
  readonly tags: readonly PartyTag[];
  /**
   * Reserve the chip lane even when THIS row has no tags.
   *
   * The screen decides, from whether the tenant uses tags at all. A book with
   * none looks exactly as it did before PTY-05 — no lane, no taller rows, no
   * cost for a feature that has not been adopted. A book with tags gets the
   * lane on EVERY row, so rows are a uniform height and the list does not step
   * up and down as it scrolls past the tagged ones. That stepping is what FRD
   * §5's "fixed 24 px chip lane" is really about: the chips arrive with the row
   * and never shift in, but rows of two different heights read as broken even
   * though nothing moved.
   */
  readonly reserveTagLane: boolean;
  /** Pre-translated, e.g. "Tags on Ramesh Traders". */
  readonly tagsLabel: string;
  /** `(count) => string`, e.g. "+3". */
  readonly overflowLabel: (count: number) => string;
  /** One on a phone card, two in a table — the screen knows which it is. */
  readonly maxTags: number;
}

function PartyNameCellBase({
  name,
  wrap = false,
  contact,
  statusLabel,
  roleLabel,
  tags,
  reserveTagLane,
  tagsLabel,
  overflowLabel,
  maxTags,
}: Readonly<PartyNameCellProps>) {
  return (
    <UbBox as="span" className="flex min-w-0 flex-col gap-1">
      <UbText
        as="span"
        variant="body-sm-medium"
        truncate={!wrap}
        className={wrap ? 'whitespace-normal break-words' : undefined}
      >
        {name}
      </UbText>
      {roleLabel && (
        <UbStatusBadge
          tone="warning"
          label={roleLabel}
          className="max-w-full self-start whitespace-normal"
        />
      )}
      {statusLabel && <UbStatusBadge tone="neutral" label={statusLabel} />}
      {contact && (
        <UbText
          as="span"
          variant="caption"
          tone="tertiary"
          className="whitespace-normal break-words"
        >
          {contact}
        </UbText>
      )}
      {reserveTagLane || tags.length > 0 ? (
        <UbTagList
          tags={toTagListItems(tags)}
          label={tagsLabel}
          max={maxTags}
          overflowLabel={overflowLabel}
          reserveSpace={reserveTagLane}
        />
      ) : null}
    </UbBox>
  );
}
PartyNameCellBase.displayName = 'PartyNameCell';
export const PartyNameCell = memo(PartyNameCellBase);

export interface PartyBalanceCellProps {
  readonly labelHidden?: boolean;
  /** Decimal string; never a number, never preformatted (R-TS-7). */
  readonly balance: string;
  /** The three direction words, pre-translated by the screen. */
  readonly labels: Readonly<Record<string, string>>;
}

function PartyBalanceCellBase({ balance, labels, labelHidden }: Readonly<PartyBalanceCellProps>) {
  const view = balanceView(balance);
  return (
    <UbAmount
      value={balance}
      labelHidden={labelHidden}
      className="whitespace-normal"
      tone={view.tone}
      sign={view.sign}
      /* §23.2.6 rule 2 — the label sits beside the figure at every width. The
         colour repeats what the word already said; it never says it alone. */
      label={labels[view.labelId] ?? ''}
      size="sm"
    />
  );
}
PartyBalanceCellBase.displayName = 'PartyBalanceCell';
export const PartyBalanceCell = memo(PartyBalanceCellBase);

export interface PartyMetaCellProps {
  readonly text: string;
  readonly wrap?: boolean;
}

/** The supporting facts: how stale the party is, and how to reach them. */
function PartyMetaCellBase({ text, wrap = false }: Readonly<PartyMetaCellProps>) {
  return (
    <UbText
      as="span"
      variant="inherit"
      truncate={!wrap}
      className={wrap ? 'whitespace-normal break-words' : undefined}
    >
      {text}
    </UbText>
  );
}
PartyMetaCellBase.displayName = 'PartyMetaCell';
export const PartyMetaCell = memo(PartyMetaCellBase);

export interface PartyStatusCellProps {
  readonly label: string;
  readonly archived: boolean;
}

function PartyStatusCellBase({ label, archived }: Readonly<PartyStatusCellProps>) {
  return <UbStatusBadge tone={archived ? 'neutral' : 'success'} label={label} />;
}
PartyStatusCellBase.displayName = 'PartyStatusCell';
export const PartyStatusCell = memo(PartyStatusCellBase);

/** Same action and permission/recipient gate in a table or phone row. */
export const ShopPartyRowActions = memo(function ShopPartyRowActions({
  party,
  t,
  onOpen,
  onRemind,
  onPay,
  onSettle,
  supplier = false,
}: Readonly<{
  party: Party;
  t: TranslateFn;
  onOpen?: (party: Party) => void;
  onRemind?: (party: Party) => void;
  onPay?: (party: Party) => void;
  /** BP-08 — offered when this person owes AND is owed in the Shop. */
  onSettle?: (party: Party) => void;
  supplier?: boolean;
}>) {
  /* Counter Mode `#customers`: a person in both lists, owing both ways, gets
     "Settle…" as the row's action in either list (a contra entry starts from the
     ledger list in Sage 200 too). Once one side is zero it is Remind or Pay again. */
  const settleable = Boolean(
    onSettle &&
    party.isCustomer &&
    party.isSupplier &&
    party.status !== 'archived' &&
    party.shop &&
    compareMoney(party.shop.customerBalance, '0') > 0 &&
    compareMoney(party.shop.supplierBalance, '0') > 0
  );
  if (settleable) {
    const label = t('parties.list.shop.settle');
    return (
      <UbButton
        variant="outlineNeutral"
        size="sm"
        aria-label={t('parties.list.shop.settleLabel', { name: party.name })}
        onClick={() => onSettle?.(party)}
        data-testid="party-row-settle"
      >
        {label}
      </UbButton>
    );
  }
  const remindable = Boolean(
    !supplier &&
    onRemind &&
    party.shop &&
    party.mobile &&
    party.status !== 'archived' &&
    compareMoney(party.balance, '0') > 0
  );
  const payable = Boolean(
    supplier && onPay && party.status !== 'archived' && compareMoney(party.balance, '0') < 0
  );
  const label = t(
    payable
      ? 'parties.list.supplier.pay'
      : remindable
        ? 'parties.list.shop.remind'
        : 'parties.list.shop.viewBills'
  );
  if (!remindable && !payable && !onOpen) return null;
  return (
    <UbButton
      variant="outlineNeutral"
      size="sm"
      aria-label={`${label} · ${party.name}`}
      onClick={() => {
        if (payable) onPay?.(party);
        else if (remindable) onRemind?.(party);
        else onOpen?.(party);
      }}
    >
      {label}
    </UbButton>
  );
});
