'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { Plus } from 'lucide-react';

import {
  UbBox,
  UbButton,
  UbDrawerLoading,
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

import { Figure, Figures, List } from 'modules/DigiKhaato/features/appParts/AppParts';

import { selectLending } from '../redux/lendingSlice';
import { fetchBorrower } from '../redux/lendingThunks';
import { LENDING_ROUTES } from '../routes';
import { planLine, rupees, shortDate } from '../view-model/lendingDisplay';

const BorrowerDrawer = dynamic(() => import('./BorrowerDrawer').then((m) => m.BorrowerDrawer), {
  loading: () => <UbDrawerLoading />,
});

/** A borrower: what they still owe across their loans, and each loan. */
export function BorrowerPageContent({ id }: Readonly<{ id: string }>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lend = useAppSelector(selectLending);
  const today = useMemo(() => todayInTenantTz(), []);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => dispatch(fetchBorrower(id)), [dispatch, id]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);
  const b = lend.borrower.data?.id === id ? lend.borrower.data : null;

  if (lend.borrower.status === 'failed' && !b)
    return (
      <UbPageShell>
        <UbEmptyState variant="error" title={t('lending.borrower.error')} action={<UbButton onClick={load}>{t('lending.common.tryAgain')}</UbButton>} />
      </UbPageShell>
    );
  if (!b)
    return (
      <UbPageShell>
        <UbSkeleton variant="list" count={4} label={t('lending.common.loading')} />
      </UbPageShell>
    );

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader
          title={b.name}
          subtitle={[b.mobile ? `+91 ${b.mobile.slice(0, 5)} ${b.mobile.slice(5)}` : null, b.work, b.route].filter(Boolean).join(' · ')}
          actions={
            <UbStack direction="row" gap={2}>
              <UbButton variant="outlineNeutral" onClick={() => setEditing(true)}>
                {t('lending.borrower.edit')}
              </UbButton>
              <UbButton variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => router.push(LENDING_ROUTES.newLoanFor(b.id))}>
                {t('lending.today.newLoan')}
              </UbButton>
            </UbStack>
          }
          renderMobileActions={(a) => a}
        />
        <Figures testId="lending-borrower-figures">
          <Figure label={t('lending.fig.left')} value={rupees(b.left)} caption={t('lending.borrowers.loans', { count: b.loans })} />
          <Figure label={t('lending.fig.late')} value={rupees(b.late)} tone={Number(b.late) > 0 ? 'give' : undefined} />
        </Figures>
        {b.allLoans.length === 0 ? (
          <UbText variant="inherit" className="text-[13px] text-text-tertiary">
            {t('lending.borrower.noLoans')}
          </UbText>
        ) : (
          <List testId="lending-borrower-loans">
            {b.allLoans.map((l) => (
              <UbBox as="li" key={l.id}>
                <UbPressable onClick={() => router.push(LENDING_ROUTES.loan(l.id))} className="flex min-h-14 w-full items-center gap-3 border-b border-border-hairline px-4 py-3 text-left">
                  <UbStack gap={0} className="min-w-0 flex-1">
                    <UbText variant="inherit" className="text-[14px] font-medium">
                      {`${l.number} · ${rupees(l.lent)}`}
                    </UbText>
                    <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
                      {`${planLine(l, t)} · ${shortDate(l.startsOn, today)}`}
                    </UbText>
                  </UbStack>
                  <UbStatusBadge
                    label={l.status === 'closed' ? t('lending.loan.paidUpShort') : t('lending.loan.leftShort', { amount: rupees(l.left) })}
                    tone={l.status === 'closed' ? 'success' : Number(l.late) > 0 ? 'error' : 'neutral'}
                  />
                </UbPressable>
              </UbBox>
            ))}
          </List>
        )}
      </UbStack>
      {editing && (
        <BorrowerDrawer
          borrower={b}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}
    </UbPageShell>
  );
}
