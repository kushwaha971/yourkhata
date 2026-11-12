'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  UbAvatar,
  UbBottomBar,
  UbBox,
  UbButton,
  UbChoiceChips,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbPressable,
  UbSkeleton,
  UbStack,
  UbText,
  UbTextArea,
} from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';

import { List } from 'modules/DigiKhaato/features/appParts/AppParts';

import { messageText, recordMessage } from '../api/lendingService';
import { selectLending, setRemindKind } from '../redux/lendingSlice';
import { fetchRemind } from '../redux/lendingThunks';
import { LENDING_ROUTES } from '../routes';
import { rupees, whatsappHref } from '../view-model/lendingDisplay';

import type { Loan, RemindKind } from '../types/lending.types';

const KINDS: readonly RemindKind[] = ['late', 'due_today', 'due_tomorrow'];

/**
 * I11 · Reminders — Late, Due today and Due tomorrow. The message is plain and
 * signed by the lender's business; it can be edited; WhatsApp opens one
 * borrower at a time ("WhatsApp 1 of 6"). Nothing is sent by the app (DEC-012).
 */
export function MessagesPageContent(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const lend = useAppSelector(selectLending);
  const kind = lend.remindKind;
  const [step, setStep] = useState(0);
  const [text, setText] = useState<{ for: string; text: string; mobile: string } | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => dispatch(fetchRemind(kind)), [dispatch, kind]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);

  const rows = useMemo(() => lend.remind.data?.rows ?? [], [lend.remind.data]);
  const counts = lend.remind.data?.counts;
  const current: Loan | undefined = rows[step];

  // The message for the borrower whose turn it is, in the screen's language.
  useEffect(() => {
    if (!current) return undefined;
    const controller = new AbortController();
    messageText(current.id, kind, locale, controller.signal)
      .then((m) => setText({ for: `${current.id}:${kind}:${locale}`, text: m.text, mobile: m.mobile }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [current, kind, locale]);
  const shown = current && text?.for === `${current.id}:${kind}:${locale}` ? text : null;

  const send = () => {
    if (!current || !shown) return;
    if (!shown.mobile) {
      dispatch(showSnackbar({ severity: 'warning', id: 'lending.remind.noMobile', params: { name: current.borrower } }));
    } else {
      window.open(whatsappHref(shown.mobile, shown.text), '_blank', 'noopener');
      void recordMessage(current.id, kind, shown.text, `${current.id}-${kind}-${Date.now()}`).catch(() => undefined);
    }
    setEditing(false);
    setStep((s) => Math.min(s + 1, rows.length));
  };

  const caption = (l: Loan): string =>
    kind === 'late'
      ? t('lending.messages.lateBy', { count: l.lateDays })
      : kind === 'due_today'
        ? t('lending.messages.dueToday')
        : t('lending.messages.dueTomorrow');
  const amount = (l: Loan): string => rupees(kind === 'late' ? l.late : kind === 'due_today' ? l.dueToday : l.each);

  const body = (() => {
    if (lend.remind.status === 'failed' && !lend.remind.data)
      return <UbEmptyState variant="error" title={t('lending.messages.error')} action={<UbButton onClick={load}>{t('lending.common.tryAgain')}</UbButton>} />;
    if (!lend.remind.data) return <UbSkeleton variant="list" count={4} label={t('lending.common.loading')} />;
    if (rows.length === 0) return <UbEmptyState variant="filtered" title={t(`lending.messages.none.${kind}`)} />;
    return (
      <UbBox className="grid items-start gap-4 lg:[grid-template-columns:minmax(0,1fr)_380px]">
        <List testId="lending-remind-list">
          {rows.map((l, i) => (
            <UbBox as="li" key={l.id}>
              <UbPressable
                onClick={() => router.push(LENDING_ROUTES.loan(l.id))}
                selected={i === step}
                className="flex min-h-14 w-full items-center gap-3 border-b border-border-hairline px-4 py-3 text-left"
              >
                <UbAvatar name={l.borrower} size="sm" />
                <UbStack gap={0} className="min-w-0 flex-1">
                  <UbText variant="inherit" truncate className="text-[14px] font-medium">
                    {l.borrower}
                  </UbText>
                  <UbText variant="inherit" truncate className="text-[12.5px] text-text-tertiary">
                    {`${caption(l)} · ${l.number}`}
                  </UbText>
                </UbStack>
                <UbStack gap={0} align="end" className="leading-[1.2]">
                  <UbText variant="inherit" className={`ds-num text-[14px] font-bold ${kind === 'late' ? 'text-give' : ''}`}>
                    {amount(l)}
                  </UbText>
                  {kind === 'late' && (
                    <UbText variant="inherit" className="text-[12px] text-give">
                      {t('lending.stop.late')}
                    </UbText>
                  )}
                </UbStack>
              </UbPressable>
            </UbBox>
          ))}
        </List>
        <UbStack gap={2} data-testid="lending-remind-preview">
          <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
            {current ? t('lending.messages.previewFor', { name: current.borrower }) : t('lending.messages.allDone')}
          </UbText>
          {current && (
            <UbBox className="grid rounded-[12px] bg-[#ECE5DD] p-3 dark:bg-surface-sunken">
              {editing && shown ? (
                <UbTextArea
                  aria-label={t('lending.messages.editText')}
                  value={shown.text}
                  onChange={(v) => setText({ ...shown, text: v })}
                  className="[&_textarea]:min-h-[96px]"
                />
              ) : (
                <UbText
                  variant="inherit"
                  className="max-w-[92%] justify-self-end whitespace-pre-wrap rounded-[10px_10px_2px_10px] bg-[#DCF8C6] px-3 py-2.5 text-[14px] leading-[1.45] text-[#111] dark:bg-[#1F3B26] dark:text-text-primary"
                >
                  {shown?.text ?? t('lending.common.loading')}
                </UbText>
              )}
            </UbBox>
          )}
          <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
            {t('lending.messages.oneAtATime')}
          </UbText>
          <UbStack direction="row" gap={2} className="max-lg:hidden">
            <UbButton variant="secondary" onClick={() => setEditing((e) => !e)} disabled={!current}>
              {t('lending.messages.editText')}
            </UbButton>
            <UbButton variant="primary" onClick={send} disabled={!shown} data-testid="lending-remind-send">
              {t('lending.messages.whatsappStep', { n: Math.min(step + 1, rows.length), total: rows.length })}
            </UbButton>
          </UbStack>
        </UbStack>
      </UbBox>
    );
  })();

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-36 lg:pb-6">
        <UbPageHeader title={t('lending.messages.title')} subtitle={t('lending.messages.subtitle')} />
        <UbChoiceChips
          ariaLabel={t('lending.messages.show')}
          value={kind}
          onChange={(v) => {
            setStep(0);
            setEditing(false);
            dispatch(setRemindKind(v as RemindKind));
          }}
          options={KINDS.map((k) => ({
            value: k,
            label: counts ? t('lending.messages.chipCount', { label: t(`lending.messages.kind.${k}`), count: counts[k] }) : t(`lending.messages.kind.${k}`),
          }))}
          className="flex-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&_*]:whitespace-nowrap [&_[role=radio]]:px-2.5 [&_[role=radio]]:text-[12.5px]"
        />
        {body}
      </UbStack>
      {current && (
        <UbBottomBar
          sticky={false}
          className="fixed inset-x-0 bottom-[var(--ub-nav-offset)] z-20 grid grid-cols-2 gap-2 border-t border-border-hairline bg-surface-card px-4 pb-3.5 pt-2.5 lg:hidden"
        >
          <UbButton variant="secondary" size="lg" onClick={() => setEditing((e) => !e)}>
            {t('lending.messages.editText')}
          </UbButton>
          <UbButton variant="primary" size="lg" onClick={send} disabled={!shown} data-testid="lending-remind-send-phone">
            {t('lending.messages.whatsappStep', { n: step + 1, total: rows.length })}
          </UbButton>
        </UbBottomBar>
      )}
    </UbPageShell>
  );
}
