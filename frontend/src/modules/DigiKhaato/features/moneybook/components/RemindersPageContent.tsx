'use client';

import { useEffect, useMemo } from 'react';

import {
  UbAvatar,
  UbBox,
  UbButton,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbSkeleton,
  UbStack,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { todayInTenantTz } from 'src/utils/dates';

import { selectMoneyBook } from '../redux/moneybookSlice';
import { fetchReminders } from '../redux/moneybookThunks';
import { MONEYBOOK_ROUTES } from '../routes';
import { dayLabel } from '../view-model/moneybookDisplay';

import { List } from './MoneyBookParts';

/**
 * Reminders — the owner's own log of every reminder they opened in WhatsApp or
 * SMS, newest first. Nothing here was sent by the product (DEC-012); "Remind
 * again" opens the person, where the Remind sheet writes today's message.
 */
export function RemindersPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const book = useAppSelector(selectMoneyBook);
  const today = useMemo(() => todayInTenantTz(), []);

  useEffect(() => {
    const request = dispatch(fetchReminders());
    return () => request.abort();
  }, [dispatch]);

  const body = (() => {
    if (book.remindersStatus === 'failed')
      return (
        <UbEmptyState
          variant="error"
          title={t('moneybook.reminders.error')}
          action={
            <UbButton onClick={() => dispatch(fetchReminders())}>
              {t('moneybook.common.tryAgain')}
            </UbButton>
          }
        />
      );
    if (book.remindersStatus !== 'succeeded')
      return <UbSkeleton variant="list" count={5} label={t('moneybook.common.loading')} />;
    if (book.reminders.length === 0)
      return (
        <UbEmptyState
          variant="firstUse"
          title={t('moneybook.reminders.empty.title')}
          description={t('moneybook.reminders.empty.body')}
        />
      );
    return (
      <List>
        {book.reminders.map((r) => (
          <UbBox as="li" key={r.id}>
            <UbStack
              direction="row"
              align="center"
              gap={3}
              className="min-h-14 border-b border-border-hairline px-4 py-3"
            >
              <UbAvatar name={r.personName} size="sm" />
              <UbStack gap={0} className="min-w-0 flex-1">
                <UbText variant="inherit" truncate className="text-[14px] font-medium">
                  {r.personName}
                </UbText>
                <UbText variant="inherit" className="line-clamp-2 text-[12.5px] text-text-tertiary">
                  {t('moneybook.reminders.via', {
                    when: dayLabel(r.openedAt.slice(0, 10), today, t),
                    channel: t(
                      r.channel === 'whatsapp'
                        ? 'moneybook.remind.whatsapp'
                        : 'moneybook.remind.sms'
                    ),
                  })}
                  {` · ${r.text}`}
                </UbText>
              </UbStack>
              <UbButton
                variant="outlineNeutral"
                size="sm"
                onClick={() => router.push(MONEYBOOK_ROUTES.person(r.personId))}
              >
                {t('moneybook.reminders.again')}
              </UbButton>
            </UbStack>
          </UbBox>
        ))}
      </List>
    );
  })();

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-6">
        <UbPageHeader
          title={t('moneybook.reminders.title')}
          subtitle={t('moneybook.reminders.subtitle')}
        />
        {body}
      </UbStack>
    </UbPageShell>
  );
}
