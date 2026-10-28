import { UbStatusBadge } from 'src/design-system';
import type { UbDataGridColumn } from 'src/design-system/UbDataGrid';
import type { TranslateFn } from 'src/hooks/useTranslation';

import { activityView, contactLine } from '../view-model/partyDisplay';
import { PARTY_SORT_FIELDS } from '../view-model/partyListSort';
import { shopAgeView, shopActivityLabel } from '../view-model/shopPartyDisplay';

import {
  PartyBalanceCell,
  PartyMetaCell,
  PartyNameCell,
  PartyStatusCell,
  ShopPartyRowActions,
} from './PartyListRow';

import type { Party } from '../types/party.types';

/**
 * Part 19 §19.9.4 — a MODULE-LEVEL column factory, memoised by the screen on
 * its real dependencies. Building this array inside the component is the single
 * biggest `UbDataGrid` performance mistake there is: a new array every render
 * invalidates every cell.
 *
 * ── The priority order, and the reasoning ───────────────────────────────────
 *
 * A merchant scanning this list is deciding **who to chase today**. Every
 * column below is scored against that sentence and nothing else, because the
 * approved rule is that columns are chosen by the decision they support rather
 * than by what the table has.
 *
 * | # | Column | Priority | Why |
 * |---|---|---|---|
 * | 1 | Customer  | 1 | Who. Without it there is no row. |
 * | 2 | Balance   | 1 | How much, and in which direction. The question itself. |
 * | 3 | Last entry| 2 | How stale. ₹8,000 from last week and ₹8,000 from March are different problems, and the second is the one you call about. |
 * | 4 | Code and mobile | 3 | How to REACH them — needed to act, not to decide. It drops first. |
 * | 5 | Status    | 4 | Only ever varies when the merchant has changed the filter off `active`; on the default view it is the same word 25 times. |
 *
 * So the drop order is `status` → `contact`, and the md–lg table is exactly
 * name / balance / last entry: three columns, none of them below 13 px, and
 * nothing to drag sideways to read.
 *
 * **GSTIN, address and the customer/supplier flags are not here at all.** They
 * are real fields the API returns or soon will, and none of them changes who
 * gets a phone call this afternoon. They belong on the party's detail page,
 * where the decision they support — "is this invoice's tax right", "where do I
 * deliver" — is actually being made.
 *
 * ── Tags were on that list, and PTY-05 took them off it ─────────────────────
 * The reasoning above is right about a tag COLUMN and wrong about a tag chip,
 * and the difference is worth stating because the earlier version of this
 * comment did not see it. A column of tags would be a fourth thing to read
 * across a row that already asks four questions. A chip under the NAME is part
 * of who the party is — the merchant working through Camp Area this morning is
 * scanning for exactly that, and sending them to a detail page to find out
 * whether a row belongs to today's round is sending them to twenty-five detail
 * pages.
 *
 * So tags live in the `name` cell rather than in a column of their own, which
 * also means they survive the drop order and reach the phone card, where a
 * third `meta` slot would have been discarded.
 */
export interface PartyColumnDeps {
  /** Already-bound `t` from the screen; a column never calls `useTranslation`. */
  readonly t: TranslateFn;
  /**
   * "Now", captured once by the screen. Passing it makes `activityView` pure
   * and this array stable: a factory that read the clock itself would produce a
   * different memo key on every render.
   */
  readonly nowMs: number;
  /** The three balance direction words, resolved once by the screen. */
  readonly balanceLabels: Readonly<Record<string, string>>;
  /**
   * Whether ANY row on this page carries a tag. When none does, the chip lane
   * is not reserved and the list is exactly the height it was before PTY-05 —
   * a book that does not use tags pays nothing for them.
   */
  readonly hasTags: boolean;
  /**
   * How many chips a row shows before the rest become a count — one on a phone
   * card, two in a table. The screen reads the grid's own tier and passes it,
   * because a `cell` function is called identically at all three renderings and
   * cannot tell which one it is painting.
   */
  readonly tagChipsPerRow: number;
  /** The first column's heading when the page is one book (Suppliers). */
  readonly nameHeader?: string;
  readonly compactShop?: boolean;
  readonly compactKhata?: boolean;
  readonly supplier?: boolean;
  readonly onPay?: (party: Party) => void;
  readonly hideBalanceLabel?: boolean;
  readonly onOpen?: (party: Party) => void;
  readonly onRemind?: (party: Party) => void;
  readonly onSettle?: (party: Party) => void;
  readonly formatActivity?: (at: string) => string;
  readonly phoneCards?: boolean;
}

export const createPartyColumns = ({
  t,
  nowMs,
  balanceLabels,
  hasTags,
  tagChipsPerRow,
  nameHeader,
  compactShop = false,
  compactKhata = false,
  supplier = false,
  onPay,
  hideBalanceLabel,
  onOpen,
  onRemind,
  onSettle,
  formatActivity,
  phoneCards,
}: PartyColumnDeps): readonly UbDataGridColumn<Party>[] => {
  const columns: readonly UbDataGridColumn<Party>[] = [
    {
      id: 'name',
      header: nameHeader ?? t('parties.list.column.name'),
      priority: 1,
      sortField: PARTY_SORT_FIELDS.name,
      cardSlot: 'title',
      // A7: 24 / 20 in the Shop (was 26 / 22), the 4 % given to the actions
      // column so Hindi's "भुगतान करें" and its ⋯ fit at 1024.
      widthShare: compactKhata ? 68 : compactShop ? 24 : 34,
      cell: (party) => (
        <PartyNameCell
          name={party.name}
          wrap={compactShop || compactKhata}
          roleLabel={
            compactShop && (supplier ? party.isCustomer : party.isSupplier)
              ? t(
                  supplier ? 'parties.list.supplier.alsoCustomer' : 'parties.list.shop.alsoSupplier'
                )
              : undefined
          }
          statusLabel={
            compactShop && party.status === 'archived'
              ? t('parties.list.status.archived')
              : undefined
          }
          contact={
            compactShop
              ? phoneCards
                ? shopAgeView(party, t, supplier).label
                : contactLine(party)
              : undefined
          }
          tags={compactKhata ? [] : party.tags}
          reserveTagLane={!compactShop && !compactKhata && hasTags}
          maxTags={tagChipsPerRow}
          /* Named after the party, because a row's chip list sits beside
           twenty-four other chip lists and "Tags" alone announces as one of
           twenty-five identical lists with no way to tell which is whose. */
          tagsLabel={t('parties.tags.listLabel', { name: party.name })}
          overflowLabel={(count) => t('parties.tags.overflow', { count })}
        />
      ),
    },
    {
      id: 'balance',
      header: t('parties.list.column.balance'),
      priority: 1,
      align: 'end',
      sortField: PARTY_SORT_FIELDS.balance,
      cardSlot: 'trailing',
      widthShare: compactKhata ? 32 : compactShop ? 20 : 20,
      cell: (party) => (
        <PartyBalanceCell
          balance={party.balance}
          labels={balanceLabels}
          labelHidden={hideBalanceLabel}
        />
      ),
    },
    {
      id: 'activity',
      header: t(compactShop ? 'parties.list.shop.lastActivity' : 'parties.list.column.activity'),
      priority: 2,
      sortField: PARTY_SORT_FIELDS.activity,
      cardSlot: compactShop ? 'none' : 'meta',
      // 18 in the Shop: at 14 its header wrapped to three lines at 1024 and
      // grew the header row past 46 px (A7, measured).
      widthShare: compactShop ? 18 : 16,
      cell: (party) => {
        if (compactShop) {
          const at = party.shop?.lastActivityAt;
          return (
            <PartyMetaCell
              wrap
              text={
                at
                  ? `${formatActivity?.(at) ?? at} · ${shopActivityLabel(party.shop?.lastActivityKind, t)}`
                  : t('parties.list.shop.noActivity')
              }
            />
          );
        }
        const view = activityView(party.lastActivityAt, nowMs);
        return <PartyMetaCell text={t(view.labelId, view.values)} />;
      },
    },
    {
      id: 'contact',
      header: t('parties.list.column.contact'),
      priority: 3,
      cardSlot: 'meta',
      /**
       * Every column states a width and the five sum to 100, including this one.
       *
       * Leaving one column unsized to "take the rest" is what was here before,
       * and on a SELECTABLE grid it does not work: the checkbox column is a fixed
       * 48 px that no percentage accounts for, so the four sized columns took
       * their 92% of the full table and this one was left with 36 px — its header
       * overlapped Status and every cell read "C…". `table-fixed` scales stated
       * percentages down to fit the space the checkbox leaves, so a full hundred
       * is the shape that survives selection being switched on.
       */
      widthShare: 18,
      cell: (party) => <PartyMetaCell text={contactLine(party)} wrap />,
    },
    {
      id: 'status',
      header: t('parties.list.column.status'),
      priority: 4,
      // The card does not carry it: a phone shows the active list, and a word
      // that is the same on every row is furniture, not information.
      cardSlot: 'none',
      widthShare: 12,
      cell: (party) => (
        <PartyStatusCell
          archived={party.status === 'archived'}
          label={t(`parties.list.status.${party.status}`)}
        />
      ),
    },
  ];
  if (compactKhata) return columns.slice(0, 2);
  if (!compactShop) return columns;
  const late: UbDataGridColumn<Party> = {
    id: 'late',
    header: t('parties.list.shop.lateBy'),
    priority: 2,
    sortField: 'oldest_due_on',
    cardSlot: 'none',
    widthShare: 18,
    cell: (party) => {
      const age = shopAgeView(party, t, supplier);
      return (
        <UbStatusBadge label={age.label} tone={age.tone} className="max-w-full whitespace-normal" />
      );
    },
  };
  const actions: UbDataGridColumn<Party> = {
    id: 'actions',
    header: t('common.action.moreActions'),
    headerHidden: true,
    priority: 2,
    cardSlot: 'none',
    align: 'end',
    widthShare: 20,
    cell: (party) => (
      <ShopPartyRowActions
        party={party}
        t={t}
        onOpen={onOpen}
        onRemind={onRemind}
        onPay={onPay}
        onSettle={onSettle}
        supplier={supplier}
      />
    ),
  };

  return [
    ...columns.filter((column) => column.id === 'name' || column.id === 'balance'),
    late,
    ...columns.filter((column) => column.id === 'activity'),
    actions,
  ];
};
