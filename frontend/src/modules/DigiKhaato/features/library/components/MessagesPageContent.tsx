'use client';

import { useCallback, useEffect, useMemo } from 'react';

import {
  UbBox,
  UbButton,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbPressable,
  UbSkeleton,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { todayInTenantTz } from 'src/utils/dates';

import { selectLibrary } from '../redux/librarySlice';
import { fetchMessages } from '../redux/libraryThunks';
import { LIBRARY_ROUTES } from '../routes';
import { shortDate } from '../view-model/libraryDisplay';

import { List } from './LibraryParts';

/**
 * Messages — every fee reminder, receipt and welcome the counter OPENED in
 * WhatsApp, newest first. Nothing here was sent by the app (DEC-012); the log
 * is what settles "nobody told me".
 */
export function MessagesPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lib = useAppSelector(selectLibrary);
  const today = useMemo(() => todayInTenantTz(), []);

  const load = useCallback(() => dispatch(fetchMessages()), [dispatch]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);

  const rows = lib.messages.data ?? [];
  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader title={t('library.messages.title')} subtitle={t('library.messages.subtitle')} />
        {lib.messages.status === 'failed' && !lib.messages.data ? (
          <UbEmptyState
            variant="error"
            title={t('library.messages.error')}
            action={<UbButton onClick={load}>{t('library.common.tryAgain')}</UbButton>}
          />
        ) : !lib.messages.data ? (
          <UbSkeleton variant="list" count={5} label={t('library.common.loading')} />
        ) : rows.length === 0 ? (
          <UbEmptyState
            variant="firstUse"
            title={t('library.messages.none')}
            description={t('library.messages.noneBody')}
            action={<UbButton onClick={() => router.push(LIBRARY_ROUTES.fees)}>{t('library.messages.goFees')}</UbButton>}
          />
        ) : (
          <List testId="library-messages-list">
            {rows.map((m) => (
              <UbBox as="li" key={m.id}>
                <UbPressable
                  onClick={() => router.push(LIBRARY_ROUTES.student(m.studentId))}
                  className="grid w-full gap-1 border-b border-border-hairline px-4 py-3 text-left"
                >
                  <UbStack direction="row" align="center" justify="between" gap={2}>
                    <UbText variant="inherit" truncate className="text-[14px] font-medium">
                      {m.student}
                    </UbText>
                    <UbStatusBadge label={t(`library.messages.kind.${m.kind}`)} tone={m.kind === 'fee_due' ? 'warning' : 'success'} />
                  </UbStack>
                  <UbText variant="inherit" className="line-clamp-2 text-[12.5px] text-text-secondary">
                    {m.text}
                  </UbText>
                  <UbText variant="inherit" className="text-[12px] text-text-tertiary">
                    {t('library.messages.opened', { date: shortDate(m.openedAt.slice(0, 10), today) })}
                  </UbText>
                </UbPressable>
              </UbBox>
            ))}
          </List>
        )}
      </UbStack>
    </UbPageShell>
  );
}
