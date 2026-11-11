'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { ArrowLeft, Bell, MoreHorizontal, Pencil, Phone, Printer } from 'lucide-react';

import {
  UbActionSheet,
  UbBottomBar,
  UbBox,
  UbButton,
  UbDrawerLoading,
  UbDrawer,
  UbEmptyState,
  UbLink,
  UbPageShell,
  UbPressable,
  UbSearchInput,
  UbSkeleton,
  UbStack,
  UbSwitch,
  UbText,
  UbTextInput,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useDebounce } from 'src/hooks/useDebounce';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { cn } from 'src/utils/cn';
import { todayInTenantTz } from 'src/utils/dates';

import { selectMoneyBook, setShowRemoved } from '../redux/moneybookSlice';
import { fetchEntries, fetchPeople, fetchPerson, removeEntry } from '../redux/moneybookThunks';
import { MONEYBOOK_ROUTES } from '../routes';
import {
  balanceWords,
  entryWhen,
  KIND_WORD,
  rupees,
  shortDate,
  sideOf,
} from '../view-model/moneybookDisplay';

import { List, PersonRow } from './MoneyBookParts';

import type { Entry, EntryKind, Person } from '../types/moneybook.types';

/* The sheets load when opened, not with the page a person reads (CLAUDE.md: a form
   in the read screen's chunk cost /parties 40 KB and a khata 58 KB). */
const EntrySheet = dynamic(() => import('./EntrySheet').then((m) => m.EntrySheet), {
  loading: () => <UbDrawerLoading />,
});
const PersonFormDrawer = dynamic(
  () => import('./PersonFormDrawer').then((m) => m.PersonFormDrawer),
  {
    loading: () => <UbDrawerLoading />,
  }
);
const RemindSheet = dynamic(() => import('./RemindSheet').then((m) => m.RemindSheet), {
  loading: () => <UbDrawerLoading />,
});

const SIDE_CLASS = { get: 'text-get', give: 'text-give', settled: 'text-text-tertiary' } as const;

/** "To get from Suresh" — the balance in words over the figure (I2). */
const headline = (person: Person, t: ReturnType<typeof useTranslation>['t']): string => {
  const side = sideOf(person.balance);
  const first = person.name.split(' ')[0] ?? person.name;
  if (side === 'get') return t('moneybook.person.toGetFrom', { name: first });
  if (side === 'give') return t('moneybook.person.toGiveTo', { name: first });
  return t('moneybook.person.settledWith', { name: first });
};

/** The red and green pair: Gave money (money left you), Got money (it came back). */
function Pair({
  onEntry,
  className,
}: Readonly<{ onEntry: (kind: EntryKind) => void; className?: string }>) {
  const { t } = useTranslation();
  return (
    <UbBox className={cn('grid grid-cols-2 gap-2.5', className)}>
      <UbButton
        size="lg"
        className="bg-give text-white hover:bg-give active:bg-give dark:text-black"
        onClick={() => onEntry('gave')}
        data-testid="moneybook-gave"
      >
        {t('moneybook.entry.gave')}
      </UbButton>
      <UbButton
        size="lg"
        className="bg-get text-white hover:bg-get active:bg-get dark:text-black"
        onClick={() => onEntry('got')}
        data-testid="moneybook-got"
      >
        {t('moneybook.entry.got')}
      </UbButton>
    </UbBox>
  );
}

/**
 * I2 · A person. Phone: back, name, mobile, call; "To get from Suresh ₹4,500";
 * the dated entries with the balance after each; Gave money and Got money
 * docked at the bottom. Desktop: the people list on the left and the person on
 * the right, with Report, Remind and Call and the entries as a table.
 */
export function PersonPageContent({ id }: Readonly<{ id: string }>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const book = useAppSelector(selectMoneyBook);
  const today = useMemo(() => todayInTenantTz(), []);
  const [sheet, setSheet] = useState<EntryKind | null>(null);
  const [acting, setActing] = useState<Entry | null>(null);
  const [replacing, setReplacing] = useState<Entry | null>(null);
  const [removing, setRemoving] = useState<Entry | null>(null);
  const [reminding, setReminding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 250);
  const person = book.person?.id === id ? book.person : null;

  const load = useCallback(() => {
    const a = dispatch(fetchPerson(id));
    const b = dispatch(fetchEntries({ personId: id, includeRemoved: book.showRemoved }));
    return () => {
      a.abort();
      b.abort();
    };
  }, [dispatch, id, book.showRemoved]);
  useEffect(() => load(), [load]);

  // The desktop list beside the person: the same book, searchable.
  useEffect(() => {
    const request = dispatch(fetchPeople({ q, page: 1, pageSize: 50 }));
    return () => request.abort();
  }, [dispatch, q, book.peopleStale]);

  // After a write the balance moved: the entries' "balance after" did too.
  const refreshEntries = useCallback(
    () => void dispatch(fetchEntries({ personId: id, includeRemoved: book.showRemoved })),
    [dispatch, id, book.showRemoved]
  );

  if (book.personStatus === 'failed' && !person) {
    const missing = book.personError?.code === 'not_found';
    return (
      <UbPageShell>
        <UbEmptyState
          variant="error"
          title={t(missing ? 'moneybook.person.notFound' : 'moneybook.person.error')}
          action={
            missing ? (
              <UbLink href={MONEYBOOK_ROUTES.people}>{t('moneybook.person.back')}</UbLink>
            ) : (
              <UbButton onClick={() => load()}>{t('moneybook.common.tryAgain')}</UbButton>
            )
          }
        />
      </UbPageShell>
    );
  }

  const side = person ? sideOf(person.balance) : 'settled';
  // Only this person's entries: another person's, still held, are never shown here.
  const mine = book.entriesFor === id;
  const entries = mine ? book.entries : [];
  const call = person?.mobile ? `tel:+91${person.mobile}` : null;

  const entryList = (() => {
    if (mine && book.entriesStatus === 'failed')
      return (
        <UbEmptyState
          variant="error"
          title={t('moneybook.entries.error')}
          action={<UbButton onClick={refreshEntries}>{t('moneybook.common.tryAgain')}</UbButton>}
        />
      );
    if ((!mine || book.entriesStatus !== 'succeeded') && entries.length === 0)
      return <UbSkeleton variant="list" count={3} label={t('moneybook.common.loading')} />;
    if (entries.length === 0)
      return (
        <UbEmptyState
          variant="firstUse"
          title={t('moneybook.entries.empty.title')}
          description={t('moneybook.entries.empty.body')}
        />
      );
    return (
      <>
        {/* Phone: `ueRows` — "Got money · Paid by UPI" / "Today · ₹4,500 to get". */}
        <List className="lg:hidden">
          {entries.map((entry) => {
            const removed = entry.status === 'removed';
            return (
              <UbBox as="li" key={entry.id}>
                <UbPressable
                  onClick={() => !removed && setActing(entry)}
                  disabled={removed}
                  className="flex min-h-14 w-full items-center gap-3 border-b border-border-hairline px-4 py-3"
                  data-testid="moneybook-entry-row"
                >
                  <UbStack
                    gap={0}
                    className={cn('min-w-0 flex-1', removed && 'line-through opacity-60')}
                  >
                    <UbText
                      variant="inherit"
                      truncate
                      className="text-[14px] font-medium text-text-primary"
                    >
                      {t(KIND_WORD[entry.kind])}
                      {entry.note && (
                        <UbText
                          as="span"
                          variant="inherit"
                          className="font-normal text-text-tertiary"
                        >{` · ${entry.note}`}</UbText>
                      )}
                    </UbText>
                    <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
                      {`${entryWhen(entry, today, t)} · ${removed ? t('moneybook.entries.removed') : balanceWords(entry.balanceAfter ?? '0', t)}`}
                    </UbText>
                  </UbStack>
                  <UbText
                    variant="inherit"
                    className={cn(
                      'ds-num text-[14px] font-bold',
                      removed
                        ? 'text-text-tertiary'
                        : entry.kind === 'got'
                          ? 'text-get'
                          : 'text-give'
                    )}
                  >
                    {rupees(entry.amount)}
                  </UbText>
                </UbPressable>
              </UbBox>
            );
          })}
        </List>
        {/* Desktop: Date · Entry · Note · Amount · Balance. */}
        <UbBox
          as="table"
          className="hidden w-full border-collapse text-[13.4px] lg:table [&_td]:border-b [&_td]:border-border-hairline [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2"
        >
          <UbBox
            as="thead"
            className="bg-surface-sunken text-left text-[11.8px] text-text-secondary"
          >
            <UbBox as="tr">
              {(['date', 'entry', 'note'] as const).map((c) => (
                <UbBox as="th" key={c} className="font-semibold">
                  {t(`moneybook.entries.col.${c}`)}
                </UbBox>
              ))}
              <UbBox as="th" className="text-right font-semibold">
                {t('moneybook.entries.col.amount')}
              </UbBox>
              <UbBox as="th" className="text-right font-semibold">
                {t('moneybook.entries.col.balance')}
              </UbBox>
              <UbBox as="th" />
            </UbBox>
          </UbBox>
          <UbBox as="tbody">
            {entries.map((entry) => {
              const removed = entry.status === 'removed';
              const colour = removed
                ? 'text-text-tertiary'
                : entry.kind === 'got'
                  ? 'text-get'
                  : 'text-give';
              return (
                <UbBox as="tr" key={entry.id} className={cn(removed && 'line-through opacity-60')}>
                  <UbBox as="td">{entryWhen(entry, today, t)}</UbBox>
                  <UbBox as="td" className={cn('font-semibold', colour)}>
                    {t(KIND_WORD[entry.kind])}
                  </UbBox>
                  <UbBox as="td" className="text-text-secondary">
                    {entry.reason && removed ? entry.reason : entry.note}
                  </UbBox>
                  <UbBox as="td" className={cn('ds-num text-right font-bold', colour)}>
                    {rupees(entry.amount)}
                  </UbBox>
                  <UbBox as="td" className="ds-num text-right">
                    {removed
                      ? t('moneybook.entries.removed')
                      : balanceWords(entry.balanceAfter ?? '0', t)}
                  </UbBox>
                  <UbBox as="td" className="w-10 text-right">
                    {!removed && (
                      <UbButton
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={<MoreHorizontal className="h-4 w-4" aria-hidden />}
                        onClick={() => setActing(entry)}
                      >
                        {t('moneybook.entry.actions')}
                      </UbButton>
                    )}
                  </UbBox>
                </UbBox>
              );
            })}
          </UbBox>
        </UbBox>
      </>
    );
  })();

  const peopleRail = (
    <UbStack gap={2.5} className="hidden w-[300px] shrink-0 lg:flex">
      <UbSearchInput
        value={search}
        onChange={setSearch}
        placeholder={t('moneybook.people.searchShort')}
        aria-label={t('moneybook.people.searchShort')}
      />
      <List>
        {(book.people?.rows ?? []).map((row) => (
          <PersonRow
            key={row.id}
            person={row}
            today={today}
            t={t}
            selected={row.id === id}
            onOpen={(next) => router.push(MONEYBOOK_ROUTES.person(next))}
          />
        ))}
      </List>
    </UbStack>
  );

  return (
    <UbPageShell>
      <UbStack direction="row" align="start" gap={4} className="pb-28 lg:pb-6">
        {peopleRail}
        <UbStack gap={3} className="min-w-0 flex-1">
          {/* Header: back (phone), name, mobile · since; Report · Remind · Call. */}
          <UbStack direction="row" align="center" gap={2}>
            <UbLink
              href={MONEYBOOK_ROUTES.people}
              aria-label={t('moneybook.person.back')}
              underline={false}
              className="-ml-2 flex h-11 w-11 items-center justify-center lg:hidden"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </UbLink>
            <UbStack gap={0} className="min-w-0 flex-1">
              <UbText
                as="h1"
                variant="inherit"
                className="line-clamp-2 break-words text-[17px] font-semibold lg:text-[22px] lg:font-bold"
              >
                {person?.name ?? ''}
              </UbText>
              <UbText variant="inherit" className="ds-num text-[12.5px] text-text-tertiary">
                {[
                  person?.mobile
                    ? `+91 ${person.mobile.slice(0, 5)} ${person.mobile.slice(5)}`
                    : '',
                  person
                    ? t('moneybook.person.since', { date: shortDate(person.since, today) })
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </UbText>
            </UbStack>
            {call && (
              <UbLink
                href={call}
                aria-label={t('moneybook.person.call')}
                underline={false}
                className="flex h-11 w-11 items-center justify-center lg:hidden"
              >
                <Phone className="h-5 w-5" aria-hidden />
              </UbLink>
            )}
            <UbStack direction="row" gap={2} className="max-lg:hidden">
              <UbButton
                variant="outlineNeutral"
                size="sm"
                icon={<Printer className="h-4 w-4" aria-hidden />}
                onClick={() => router.push(MONEYBOOK_ROUTES.personReport(id))}
              >
                {t('moneybook.person.report')}
              </UbButton>
              {side === 'get' && (
                <UbButton
                  variant="outlineNeutral"
                  size="sm"
                  icon={<Bell className="h-4 w-4" aria-hidden />}
                  onClick={() => setReminding(true)}
                >
                  {t('moneybook.person.remind')}
                </UbButton>
              )}
              {call && (
                <UbButton
                  variant="outlineNeutral"
                  size="sm"
                  icon={<Phone className="h-4 w-4" aria-hidden />}
                  onClick={() => window.open(call, '_self')}
                >
                  {t('moneybook.person.call')}
                </UbButton>
              )}
            </UbStack>
            <UbButton
              variant="ghost"
              size="sm"
              iconOnly
              icon={<MoreHorizontal className="h-5 w-5" aria-hidden />}
              onClick={() => setMenu(true)}
            >
              {t('moneybook.person.more')}
            </UbButton>
          </UbStack>

          {/* "To get from Suresh ₹4,500" — with the pair beside it on a desktop. */}
          {person ? (
            <UbBox className="flex items-center gap-3 rounded-xl border border-border-hairline bg-surface-card px-4 py-3">
              <UbStack gap={0} className="min-w-0 flex-1">
                <UbText variant="inherit" className="text-[12px] text-text-tertiary">
                  {headline(person, t)}
                </UbText>
                <UbText
                  variant="inherit"
                  className={cn('ds-num text-[26px] font-extrabold', SIDE_CLASS[side])}
                  data-testid="moneybook-balance"
                >
                  {rupees(person.balance)}
                </UbText>
              </UbStack>
              <Pair onEntry={setSheet} className="max-lg:hidden" />
            </UbBox>
          ) : (
            <UbSkeleton variant="figure" />
          )}

          {/* Phone quick actions: Report and Remind, one tap from the page. */}
          <UbStack direction="row" gap={2} className="lg:hidden">
            <UbButton
              variant="outlineNeutral"
              size="sm"
              icon={<Printer className="h-4 w-4" aria-hidden />}
              onClick={() => router.push(MONEYBOOK_ROUTES.personReport(id))}
            >
              {t('moneybook.person.report')}
            </UbButton>
            {side === 'get' && (
              <UbButton
                variant="outlineNeutral"
                size="sm"
                icon={<Bell className="h-4 w-4" aria-hidden />}
                onClick={() => setReminding(true)}
              >
                {t('moneybook.person.remind')}
              </UbButton>
            )}
          </UbStack>

          <UbStack direction="row" align="center" justify="between" gap={3}>
            <UbText
              variant="inherit"
              className="whitespace-nowrap text-[13px] font-semibold text-text-secondary"
            >
              {t('moneybook.entries.count', { count: mine ? book.entriesTotal : 0 })}
            </UbText>
            <UbSwitch
              checked={book.showRemoved}
              onCheckedChange={(next) => dispatch(setShowRemoved(next))}
              label={t('moneybook.entries.showRemoved')}
            />
          </UbStack>
          {entryList}
        </UbStack>
      </UbStack>

      {/* The docked pair, under the thumb on a phone. */}
      <UbBottomBar sticky className="lg:hidden">
        <Pair onEntry={setSheet} />
      </UbBottomBar>

      {person && sheet && (
        <EntrySheet
          person={person}
          kind={sheet}
          onClose={() => {
            setSheet(null);
            refreshEntries();
          }}
        />
      )}
      {person && replacing && (
        <EntrySheet
          person={person}
          kind={replacing.kind}
          replacing={replacing}
          onClose={() => {
            setReplacing(null);
            refreshEntries();
          }}
        />
      )}
      <UbActionSheet
        open={acting !== null}
        onOpenChange={(next) => !next && setActing(null)}
        title={t('moneybook.entry.actions')}
        closeLabel={t('moneybook.common.close')}
        rows={[
          {
            key: 'change',
            label: t('moneybook.entry.change'),
            icon: <Pencil className="h-4 w-4" aria-hidden />,
            onSelect: () => {
              setReplacing(acting);
              setActing(null);
            },
          },
          {
            key: 'remove',
            label: t('moneybook.entry.remove'),
            tone: 'danger',
            onSelect: () => {
              setRemoving(acting);
              setActing(null);
            },
          },
        ]}
      >
        <UbText variant="inherit" className="px-4 pb-2 text-[12.5px] text-text-tertiary">
          {t('moneybook.entry.keepsHistory')}
        </UbText>
      </UbActionSheet>
      {removing && (
        <RemoveEntryDrawer
          entry={removing}
          onClose={() => {
            setRemoving(null);
            refreshEntries();
          }}
        />
      )}
      {person && reminding && (
        <RemindSheet
          person={person}
          onClose={() => setReminding(false)}
          onAddMobile={() => {
            setReminding(false);
            setEditing(true);
          }}
        />
      )}
      <UbActionSheet
        open={menu}
        onOpenChange={setMenu}
        title={person?.name ?? ''}
        closeLabel={t('moneybook.common.close')}
        rows={[
          {
            key: 'edit',
            label: t('moneybook.person.edit'),
            icon: <Pencil className="h-4 w-4" aria-hidden />,
            onSelect: () => {
              setMenu(false);
              setEditing(true);
            },
          },
          {
            key: 'report',
            label: t('moneybook.person.report'),
            icon: <Printer className="h-4 w-4" aria-hidden />,
            onSelect: () => router.push(MONEYBOOK_ROUTES.personReport(id)),
          },
        ]}
      />
      {editing && (
        <PersonFormDrawer
          open
          person={person}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      )}
    </UbPageShell>
  );
}

/** Remove an entry: a reason, then a removal row. The old entry stays, marked removed. */
function RemoveEntryDrawer({ entry, onClose }: Readonly<{ entry: Entry; onClose: () => void }>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { key, rotate } = useIdempotencyKey();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const confirm = async (): Promise<void> => {
    setSaving(true);
    const action = await dispatch(removeEntry({ entryId: entry.id, reason: reason.trim(), key }));
    setSaving(false);
    if (removeEntry.fulfilled.match(action)) {
      rotate();
      dispatch(
        showSnackbar({
          severity: 'success',
          id: 'moneybook.entry.removed',
          params: { balance: balanceWords(action.payload.balance, t) },
        })
      );
      onClose();
      return;
    }
    dispatch(
      showSnackbar({
        severity: 'error',
        message: action.payload?.message ?? t('moneybook.entry.error'),
      })
    );
  };
  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('moneybook.entry.remove')}
      description={`${t(KIND_WORD[entry.kind])} · ${rupees(entry.amount)}${entry.note ? ` · ${entry.note}` : ''}`}
      closeLabel={t('moneybook.common.close')}
      keyboardAware
      footer={
        <UbButton
          variant="destructive"
          size="lg"
          busy={saving}
          onClick={() => void confirm()}
          data-testid="moneybook-remove-confirm"
        >
          {t('moneybook.entry.removeConfirm')}
        </UbButton>
      }
    >
      <UbStack gap={2}>
        <UbText variant="inherit" className="text-[13px] font-semibold">
          {t('moneybook.entry.reason')}
        </UbText>
        <UbTextInput
          value={reason}
          onChange={setReason}
          placeholder={t('moneybook.entry.reasonHint')}
          aria-label={t('moneybook.entry.reason')}
        />
        <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
          {t('moneybook.entry.keepsHistory')}
        </UbText>
      </UbStack>
    </UbDrawer>
  );
}
