'use client';

import { useCallback, useEffect, useState } from 'react';

import dynamic from 'next/dynamic';

import { FileUp, Plus } from 'lucide-react';

import {
  UbAvatar,
  UbBox,
  UbButton,
  UbDrawerLoading,
  UbEmptyState,
  UbFab,
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
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';

import { List } from 'modules/DigiKhaato/features/appParts/AppParts';

import { useLendingAccess } from '../hooks/useLendingAccess';
import { selectLending } from '../redux/lendingSlice';
import { fetchBorrowers } from '../redux/lendingThunks';
import { LENDING_ROUTES } from '../routes';
import { rupees } from '../view-model/lendingDisplay';

const BorrowerDrawer = dynamic(() => import('./BorrowerDrawer').then((m) => m.BorrowerDrawer), {
  loading: () => <UbDrawerLoading />,
});

/** Borrowers — who the lender lends to, what they still owe and what is late. */
export function BorrowersPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lend = useAppSelector(selectLending);
  const { canLend } = useLendingAccess();
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 250);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => dispatch(fetchBorrowers(q)), [dispatch, q]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);
  const rows = lend.borrowers.data ?? [];

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader
          title={t('lending.borrowers.title')}
          actions={
            !canLend ? undefined : (
            <UbStack direction="row" gap={2} className="max-lg:hidden">
              <UbButton variant="outlineNeutral" icon={<FileUp className="h-4 w-4" aria-hidden />} onClick={() => router.push(`${ROUTES.IMPORTS}?kind=loans`)}>
                {t('lending.borrowers.import')}
              </UbButton>
              <UbButton variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setAdding(true)}>
                {t('lending.borrower.add')}
              </UbButton>
            </UbStack>
            )
          }
          renderMobileActions={() => null}
        />
        <UbSearchInput value={search} onChange={setSearch} placeholder={t('lending.borrowers.search')} aria-label={t('lending.borrowers.search')} />
        {lend.borrowers.status === 'failed' && !lend.borrowers.data ? (
          <UbEmptyState variant="error" title={t('lending.borrowers.error')} action={<UbButton onClick={load}>{t('lending.common.tryAgain')}</UbButton>} />
        ) : !lend.borrowers.data ? (
          <UbSkeleton variant="list" count={6} label={t('lending.common.loading')} />
        ) : rows.length === 0 ? (
          q ? (
            <UbEmptyState variant="filtered" title={t('lending.borrowers.noMatch')} />
          ) : (
            <UbEmptyState
              variant="firstUse"
              title={t('lending.borrowers.none')}
              description={t('lending.borrowers.noneBody')}
              action={canLend ? <UbButton onClick={() => setAdding(true)}>{t('lending.borrower.add')}</UbButton> : undefined}
            />
          )
        ) : (
          <List testId="lending-borrowers-list">
            {rows.map((b) => (
              <UbBox as="li" key={b.id}>
                <UbPressable onClick={() => router.push(LENDING_ROUTES.borrower(b.id))} className="flex min-h-14 w-full items-center gap-3 border-b border-border-hairline px-4 py-3 text-left">
                  <UbAvatar name={b.name} size="sm" />
                  <UbStack gap={0} className="min-w-0 flex-1">
                    <UbText variant="inherit" truncate className="text-[14px] font-medium">
                      {b.name}
                    </UbText>
                    <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
                      {[b.work, b.route, t('lending.borrowers.loans', { count: b.loans })].filter(Boolean).join(' · ')}
                    </UbText>
                  </UbStack>
                  <UbStack gap={0} align="end" className="leading-[1.2]">
                    <UbText variant="inherit" className="ds-num text-[14px] font-bold">
                      {rupees(b.left)}
                    </UbText>
                    {Number(b.late) > 0 && (
                      <UbText variant="inherit" className="ds-num text-[12px] text-give">
                        {t('lending.stop.lateAmount', { amount: rupees(b.late) })}
                      </UbText>
                    )}
                  </UbStack>
                </UbPressable>
              </UbBox>
            ))}
          </List>
        )}
      </UbStack>
      {canLend && <UbFab label={t('lending.borrower.add')} icon={<Plus className="h-4 w-4" aria-hidden />} mobileOnly extended onClick={() => setAdding(true)} />}
      {adding && (
        <BorrowerDrawer
          onClose={() => setAdding(false)}
          onSaved={(b) => {
            setAdding(false);
            router.push(LENDING_ROUTES.borrower(b.id));
          }}
        />
      )}
    </UbPageShell>
  );
}
