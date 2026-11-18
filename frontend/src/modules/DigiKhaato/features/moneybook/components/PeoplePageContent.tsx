'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Contact, Plus, Printer, SlidersHorizontal } from 'lucide-react';

import {
  UbActionSheet,
  UbAvatar,
  UbBox,
  UbButton,
  UbDrawerLoading,
  UbEmptyState,
  UbFab,
  UbNativeSelect,
  UbPageHeader,
  UbPageShell,
  UbPressable,
  UbSearchInput,
  UbSkeleton,
  UbStack,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { usePhoneContactPicker } from 'src/hooks/usePhoneContactPicker';
import { useTranslation } from 'src/hooks/useTranslation';
import { todayInTenantTz } from 'src/utils/dates';
import type { PickedPhoneContact } from 'src/utils/phoneContacts';

import { setQuery, selectMoneyBook } from '../redux/moneybookSlice';
import { fetchPeople } from '../redux/moneybookThunks';
import { MONEYBOOK_ROUTES } from '../routes';
import { lastEntryLine, rupees } from '../view-model/moneybookDisplay';

import { Figure, Figures, List, PersonAmount, PersonRow } from './MoneyBookParts';

import type { BalanceFilter, PeopleSort } from '../types/moneybook.types';

/** A form belongs in the chunk that opens it: React Hook Form and Yup load on Add. */
const PersonFormDrawer = dynamic(
  () => import('./PersonFormDrawer').then((m) => m.PersonFormDrawer),
  {
    loading: () => <UbDrawerLoading />,
  }
);

const BALANCES: readonly BalanceFilter[] = ['all', 'get', 'give', 'settled'];
const SORTS: readonly PeopleSort[] = ['last_entry', 'name', 'amount'];
const PAGE = 25;

/** "+91 98··· ··18" — the design masks the number in the list (I1). */
const maskMobile = (mobile: string): string =>
  mobile ? `+91 ${mobile.slice(0, 2)}··· ··${mobile.slice(-2)}` : '—';

/**
 * I1 · People — the personal book (R-DEC-45). Two figures, To get and To give
 * (and Net on a desktop), then everyone the owner keeps money with. One search,
 * one Filters link; Add person floats on the phone. No shop words.
 */
export function PeoplePageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const book = useAppSelector(selectMoneyBook);
  const today = useMemo(() => todayInTenantTz(), []);
  const [search, setSearch] = useState(book.query.q ?? '');
  const q = useDebounce(search.trim(), 250);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  // In the design's scan-button slot, "Pick from contacts" (owner, 11 Nov): there
  // is nothing to scan in a Money Book, and a contact fills name and mobile in
  // one tap. Drawn only where the browser can pick contacts — never a dead button.
  const [picked, setPicked] = useState<PickedPhoneContact | null>(null);
  const contacts = usePhoneContactPicker((contact) => {
    setPicked(contact);
    setAdding(true);
  }, t('moneybook.people.contactsError'));
  const balance = book.query.balance ?? 'all';
  const sort = book.query.sort ?? 'last_entry';

  const load = useCallback(
    (page = 1) => dispatch(fetchPeople({ q, balance, sort, page, pageSize: PAGE })),
    [dispatch, q, balance, sort]
  );
  useEffect(() => {
    const request = load(1);
    return () => request.abort();
  }, [load]);

  const open = useCallback((id: string) => router.push(MONEYBOOK_ROUTES.person(id)), [router]);
  const people = book.people;
  const totals = people?.totals;
  const rows = people?.rows ?? [];
  const firstLoad = !people && book.peopleStatus !== 'failed';
  const emptyBook = people && people.total === 0 && !q && balance === 'all';
  const noMatch = people && people.total === 0 && !emptyBook;

  const figures = totals && (
    <Figures>
      <Figure
        label={t('moneybook.side.get')}
        value={rupees(totals.toGet)}
        caption={t('moneybook.people.count', { count: totals.peopleToGet })}
        side="get"
      />
      <Figure
        label={t('moneybook.side.give')}
        value={rupees(totals.toGive)}
        caption={t('moneybook.people.count', { count: totals.peopleToGive })}
        side="give"
      />
      <UbBox className="hidden lg:contents">
        <Figure
          label={t('moneybook.people.net')}
          value={
            Number(totals.net) >= 0
              ? t('moneybook.balance.toGet', { amount: rupees(totals.net) })
              : t('moneybook.balance.toGive', { amount: rupees(totals.net) })
          }
          caption={t('moneybook.people.across', { count: totals.people })}
        />
      </UbBox>
    </Figures>
  );

  const showSelect = (
    <UbNativeSelect
      aria-label={t('moneybook.people.show.label')}
      value={balance}
      onChange={(value) => dispatch(setQuery({ balance: value as BalanceFilter, page: 1 }))}
      options={BALANCES.map((value) => ({ value, label: t(`moneybook.people.show.${value}`) }))}
      className="w-auto"
    />
  );
  const sortSelect = (
    <UbNativeSelect
      aria-label={t('moneybook.people.sort.label')}
      value={sort}
      onChange={(value) => dispatch(setQuery({ sort: value as PeopleSort, page: 1 }))}
      options={SORTS.map((value) => ({ value, label: t(`moneybook.people.sort.${value}`) }))}
      className="w-auto"
    />
  );

  const body = (() => {
    if (book.peopleStatus === 'failed' && !people)
      return (
        <UbEmptyState
          variant="error"
          title={t('moneybook.people.error')}
          action={<UbButton onClick={() => load(1)}>{t('moneybook.common.tryAgain')}</UbButton>}
        />
      );
    if (firstLoad)
      return <UbSkeleton variant="list" count={6} label={t('moneybook.common.loading')} />;
    if (emptyBook)
      return (
        <UbEmptyState
          variant="firstUse"
          title={t('moneybook.people.empty.title')}
          description={t('moneybook.people.empty.body')}
          action={
            <UbButton
              icon={<Plus className="h-4 w-4" aria-hidden />}
              onClick={() => setAdding(true)}
            >
              {t('moneybook.people.add')}
            </UbButton>
          }
        />
      );
    if (noMatch)
      return (
        <UbEmptyState
          variant="filtered"
          title={t('moneybook.people.noMatch.title')}
          description={q ? t('moneybook.people.noMatch.body', { name: q }) : undefined}
          action={
            q ? (
              <UbButton variant="outlineNeutral" onClick={() => setAdding(true)}>
                {t('moneybook.people.noMatch.add', { name: q })}
              </UbButton>
            ) : undefined
          }
        />
      );
    return (
      <>
        {/* Phone: the design's list of rows. */}
        <List className="lg:hidden">
          {rows.map((person) => (
            <PersonRow key={person.id} person={person} today={today} t={t} onOpen={open} />
          ))}
        </List>
        {/* Desktop: Name · Mobile · Last entry · Balance · Open. */}
        <UbBox
          as="table"
          className="hidden w-full border-collapse text-[13.4px] lg:table [&_td]:border-b [&_td]:border-border-hairline [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2"
        >
          <UbBox
            as="thead"
            className="bg-surface-sunken text-left text-[11.8px] text-text-secondary"
          >
            <UbBox as="tr">
              <UbBox as="th" className="font-semibold">
                {t('moneybook.people.col.name')}
              </UbBox>
              <UbBox as="th" className="font-semibold">
                {t('moneybook.people.col.mobile')}
              </UbBox>
              <UbBox as="th" className="font-semibold">
                {t('moneybook.people.col.lastEntry')}
              </UbBox>
              <UbBox as="th" className="text-right font-semibold">
                {t('moneybook.people.col.balance')}
              </UbBox>
              <UbBox as="th" />
            </UbBox>
          </UbBox>
          <UbBox as="tbody">
            {rows.map((person) => (
              <UbBox as="tr" key={person.id} data-testid="moneybook-person-tr">
                <UbBox as="td">
                  <UbStack direction="row" align="center" gap={2}>
                    <UbAvatar name={person.name} size="sm" />
                    <UbText variant="inherit" className="font-medium">
                      {person.name}
                    </UbText>
                  </UbStack>
                </UbBox>
                <UbBox as="td" className="ds-num text-text-secondary">
                  {maskMobile(person.mobile)}
                </UbBox>
                <UbBox as="td" className="text-text-secondary">
                  {lastEntryLine(person, today, t)}
                </UbBox>
                <UbBox as="td" className="text-right">
                  <PersonAmount balance={person.balance} t={t} />
                </UbBox>
                <UbBox as="td" className="text-right">
                  {/* A tap, not a link: 25 "Open" links were 25 page prefetches at
                      once, and every navigation queued behind them for ~8 s
                      (Money Book monkey, 11 Nov). The phone rows already work this way. */}
                  <UbButton variant="link" size="sm" onClick={() => open(person.id)}>
                    {t('moneybook.people.open')}
                  </UbButton>
                </UbBox>
              </UbBox>
            ))}
          </UbBox>
        </UbBox>
        {people && rows.length < people.total && (
          <UbButton
            variant="outlineNeutral"
            fullWidth
            busy={book.peopleStatus === 'loading'}
            onClick={() => load((people.page ?? 1) + 1)}
            className="mt-3"
          >
            {t('moneybook.people.more')}
          </UbButton>
        )}
      </>
    );
  })();

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader
          title={t('moneybook.people.title')}
          subtitle={t('moneybook.people.subtitle')}
          actions={
            <UbStack direction="row" gap={2} className="max-lg:hidden">
              <UbButton
                variant="outlineNeutral"
                icon={<Printer className="h-4 w-4" aria-hidden />}
                onClick={() => router.push(MONEYBOOK_ROUTES.report)}
              >
                {t('moneybook.people.report')}
              </UbButton>
              <UbButton
                icon={<Plus className="h-4 w-4" aria-hidden />}
                onClick={() => setAdding(true)}
              >
                {t('moneybook.people.add')}
              </UbButton>
            </UbStack>
          }
          renderMobileActions={() => null}
          className="max-lg:[&_[data-ub-page-subtitle]]:hidden"
        />
        {figures}
        {!emptyBook && (
          <UbBox className="rounded-[12px] lg:border lg:border-border-hairline lg:bg-surface-card">
            <UbStack direction="row" align="center" gap={2} className="lg:p-3">
              <UbSearchInput
                value={search}
                onChange={setSearch}
                placeholder={t('moneybook.people.search')}
                aria-label={t('moneybook.people.search')}
                className="flex-1"
                trailing={
                  <UbPressable
                    onClick={() => setFiltersOpen(true)}
                    className="w-auto px-1 text-[13px] font-semibold text-text-accent underline lg:hidden"
                    data-testid="moneybook-filters"
                  >
                    {t('moneybook.people.filters')}
                  </UbPressable>
                }
              />
              {contacts.supported && (
                <UbButton
                  iconOnly
                  icon={<Contact className="h-5 w-5" aria-hidden />}
                  busy={contacts.busy}
                  onClick={() => void contacts.choose()}
                  className="h-11 w-11 shrink-0 bg-surface-nav text-white hover:bg-surface-navHover active:bg-surface-nav"
                  data-testid="moneybook-pick-contact"
                >
                  {t('moneybook.people.pickContact')}
                </UbButton>
              )}
              <UbBox className="hidden gap-2 lg:flex">
                {showSelect}
                {sortSelect}
              </UbBox>
            </UbStack>
            <UbBox className="mt-3 lg:mt-0">{body}</UbBox>
          </UbBox>
        )}
        {emptyBook && body}
      </UbStack>
      <UbFab
        label={t('moneybook.people.add')}
        icon={<Plus className="h-4 w-4" aria-hidden />}
        mobileOnly
        extended
        onClick={() => setAdding(true)}
      />
      <UbActionSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title={t('moneybook.people.filters')}
        closeLabel={t('moneybook.common.close')}
      >
        <UbStack gap={3} className="p-4">
          <UbStack direction="row" align="center" gap={2}>
            <SlidersHorizontal className="h-4 w-4 text-text-tertiary" aria-hidden />
            {showSelect}
          </UbStack>
          {sortSelect}
        </UbStack>
      </UbActionSheet>
      {adding && (
        <PersonFormDrawer
          open
          initialName={picked?.name ?? (noMatch ? q : '')}
          initialMobile={picked?.mobile ?? ''}
          onClose={() => {
            setAdding(false);
            setPicked(null);
          }}
          onSaved={(person) => {
            setAdding(false);
            setPicked(null);
            open(person.id);
          }}
        />
      )}
    </UbPageShell>
  );
}
