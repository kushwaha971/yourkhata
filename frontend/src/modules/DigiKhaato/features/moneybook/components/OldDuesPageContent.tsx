'use client';

import { useCallback, useEffect, useMemo } from 'react';

import {
  UbButton,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbSkeleton,
  UbStack,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { daysBetweenIso } from 'src/utils/calendarDays';
import { todayInTenantTz } from 'src/utils/dates';

import { selectMoneyBook } from '../redux/moneybookSlice';
import { fetchOldDues } from '../redux/moneybookThunks';
import { MONEYBOOK_ROUTES } from '../routes';

import { List, PersonRow } from './MoneyBookParts';

import type { Person } from '../types/moneybook.types';

/**
 * Old dues — everyone who owes the owner and has had no entry for 30 days,
 * the quietest first: the people a reminder is most worth sending to.
 */
export function OldDuesPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const book = useAppSelector(selectMoneyBook);
  const today = useMemo(() => todayInTenantTz(), []);

  useEffect(() => {
    const request = dispatch(fetchOldDues());
    return () => request.abort();
  }, [dispatch]);

  // The row's second line says how long it has been quiet, not the last note.
  const quiet = useCallback(
    (person: Person): string =>
      person.lastEntryDate
        ? t('moneybook.oldDues.quiet', { count: daysBetweenIso(person.lastEntryDate, today) })
        : t('moneybook.oldDues.never'),
    [t, today]
  );

  const days = book.oldDuesDays;
  const body = (() => {
    if (book.oldDuesStatus === 'failed')
      return (
        <UbEmptyState
          variant="error"
          title={t('moneybook.oldDues.error')}
          action={
            <UbButton onClick={() => dispatch(fetchOldDues())}>
              {t('moneybook.common.tryAgain')}
            </UbButton>
          }
        />
      );
    if (book.oldDuesStatus !== 'succeeded')
      return <UbSkeleton variant="list" count={5} label={t('moneybook.common.loading')} />;
    if (book.oldDues.length === 0)
      return (
        <UbEmptyState
          variant="firstUse"
          title={t('moneybook.oldDues.empty.title')}
          description={t('moneybook.oldDues.empty.body', { days })}
        />
      );
    return (
      <List>
        {book.oldDues.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            today={today}
            t={t}
            caption={quiet(person)}
            onOpen={(id) => router.push(MONEYBOOK_ROUTES.person(id))}
          />
        ))}
      </List>
    );
  })();

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-6">
        <UbPageHeader
          title={t('moneybook.oldDues.title')}
          subtitle={t('moneybook.oldDues.subtitle', { days })}
        />
        {body}
      </UbStack>
    </UbPageShell>
  );
}
