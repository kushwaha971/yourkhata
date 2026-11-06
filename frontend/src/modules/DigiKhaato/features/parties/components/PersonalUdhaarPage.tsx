'use client';

import { useCallback, useState } from 'react';

import dynamic from 'next/dynamic';

import { ArrowLeft, FileText, MessageSquare, Minus, Pencil, Phone, Plus } from 'lucide-react';

import {
  UbBottomBar,
  UbButton,
  UbDialogLoading,
  UbDrawerLoading,
  UbEmptyState,
  UbLink,
  UbPageHeader,
  UbPageShell,
  UbSkeleton,
  UbStack,
  UbStatusBanner,
  UbViewportPageShell,
  useIsMobileLayer,
} from 'src/design-system';
import { UbWhatsAppIcon } from 'src/design-system/UbWhatsAppIcon';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';
import { ROUTES, partyStatementPath } from 'src/routes';
import { copyText } from 'src/utils/clipboard';
import { toDialableNumber } from 'src/utils/share';

import { PartyLedgerTimeline } from 'modules/DigiKhaato/features/ledger/components/PartyLedgerTimeline';
import { useLedgerEntryForm } from 'modules/DigiKhaato/features/ledger/hooks/useLedgerEntryForm';
import { usePartyReminder } from 'modules/DigiKhaato/features/ledger/hooks/usePartyReminder';

import { KHATA_BOOK_WORDS } from '../constants/partyFilters';
import { usePartyArchive } from '../hooks/usePartyArchive';
import { usePartyDetail } from '../hooks/usePartyDetail';
import { usePartyForm } from '../hooks/usePartyForm';

import { UdhaarPersonOverview } from './UdhaarPersonOverview';

const PersonForm = dynamic(() => import('./PartyFormDrawer').then((m) => m.PartyFormDrawer), {
  ssr: false,
  loading: () => <UbDrawerLoading />,
});
const EntryForm = dynamic(
  () =>
    import('modules/DigiKhaato/features/ledger/components/LedgerEntryDrawer').then(
      (m) => m.LedgerEntryDrawer
    ),
  { ssr: false,
  loading: () => <UbDrawerLoading /> }
);
const Reminder = dynamic(
  () =>
    import('modules/DigiKhaato/features/reminders/components/PartyReminderSheet').then(
      (m) => m.PartyReminderSheet
    ),
  { ssr: false, loading: () => <UbDialogLoading /> }
);

/** Personal money between people: identity, balance, history and the next entry. */
export function PersonalUdhaarPage({ id }: Readonly<{ id: string }>): React.JSX.Element {
  const { t } = useTranslation();
  const words = useCallback<TranslateFn>(
    (key, values) => t(KHATA_BOOK_WORDS[key] ?? key, values),
    [t]
  );
  const detail = usePartyDetail(id);
  const person = detail.party ?? detail.cachedRow;
  const personForm = usePartyForm();
  const entryForm = useLedgerEntryForm();
  const archive = usePartyArchive(id);
  const { can, hasModule } = usePermissions();
  const mobileLayer = useIsMobileLayer();
  const [copied, setCopied] = useState(false);
  const [reminderChannel, setReminderChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const balance = detail.summary?.balance ?? person?.balance ?? '0.00';
  const reminder = usePartyReminder(
    detail.party
      ? {
          id,
          name: detail.party.name,
          mobile: detail.party.mobile,
          balance,
          isArchived: detail.isArchived,
        }
      : null
  );
  const copy = useCallback(
    async (value: string) => setCopied(await copyText(toDialableNumber(value))),
    []
  );
  const canRead = hasModule('ledger') && can('ledger.entry.read');
  const canRecord = Boolean(detail.party) && !detail.isArchived && entryForm.canWrite;

  if (detail.notFound)
    return (
      <UbPageShell>
        <UbEmptyState
          variant="error"
          title={t('parties.detail.notFound')}
          action={<UbLink href={ROUTES.KHATA}>{t('parties.khata.back')}</UbLink>}
        />
      </UbPageShell>
    );
  if (detail.status === 'failed' && !person)
    return (
      <UbPageShell>
        <UbEmptyState
          variant="error"
          title={t('parties.detail.error.title')}
          action={<UbButton onClick={detail.refetch}>{t('common.action.retry')}</UbButton>}
        />
      </UbPageShell>
    );
  if (!person)
    return (
      <UbPageShell>
        <UbSkeleton variant="card" />
      </UbPageShell>
    );

  const pair = (
    <>
      <UbButton
        className="bg-error text-white hover:bg-error active:bg-error dark:text-black"
        icon={<Minus className="h-4 w-4" aria-hidden />}
        onClick={() => entryForm.openEntry(id, 'debit')}
      >
        {t('ledger.entry.gave')}
      </UbButton>
      <UbButton
        variant="primary"
        data-testid="personal-got-money"
        className="bg-surface-nav text-white hover:bg-surface-navHover active:bg-surface-nav"
        icon={<Plus className="h-4 w-4" aria-hidden />}
        onClick={() => entryForm.openEntry(id, 'credit')}
      >
        {t('ledger.entry.got')}
      </UbButton>
    </>
  );
  const actionInk = 'text-text-accent text-body-sm font-normal [&>span]:font-normal';
  const actionClass = `ub-hit flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-control px-1 text-center no-underline ${actionInk}`;
  const actionButtonClass = `h-auto min-h-14 flex-col gap-1 px-1 ${actionInk}`;
  return (
    <UbViewportPageShell
      header={
        <UbStack direction="row" align="start" gap={2}>
          <UbLink href={ROUTES.KHATA} aria-label={t('parties.khata.back')} title={t('parties.khata.back')} underline={false} tone="secondary" data-testid="personal-back" className="-mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-control active:bg-surface-active">
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </UbLink>
          <UbPageHeader
            className="min-w-0 flex-1"
            title={person.name}
            wrapTitle
            primaryActions={!mobileLayer && canRecord ? pair : undefined}
            actions={
              detail.party && personForm.canEdit ? (
                <UbButton
                  variant="ghost"
                  iconOnly
                  icon={<Pencil className="h-4 w-4" aria-hidden />}
                  onClick={() => detail.party && personForm.openEdit(detail.party)}
                >
                  {t('parties.khata.edit')}
                </UbButton>
              ) : undefined
            }
          />
        </UbStack>
      }
    >
      <UbStack gap={3} className="min-h-0 flex-1 overflow-hidden">
        {detail.isArchived && (
          <UbStatusBanner
            tone="info"
            title={t('parties.khata.hidden')}
            action={
              archive.canArchive ? (
                <UbButton variant="secondary" busy={archive.restoring} onClick={archive.restore}>
                  {t('parties.khata.showAgain')}
                </UbButton>
              ) : undefined
            }
          />
        )}
        <UdhaarPersonOverview
          t={words}
          name={person.name}
          mobile={person.mobile}
          balance={balance}
          pending={detail.status === 'loading' || detail.status === 'refreshing'}
          copied={copied}
          onCopy={copy}
        />
        <UbStack
          className="grid shrink-0 grid-cols-4 items-start gap-2 border-b border-border-hairline pb-2"
          data-testid="udhaar-person-actions"
        >
          {canRead ? (
            <UbLink href={partyStatementPath(id, 'main')} variant="body-sm" className={actionClass}>
              <FileText className="h-5 w-5" aria-hidden />
              {t('parties.khata.statement')}
            </UbLink>
          ) : (
            <UbStack />
          )}
          {reminder.canRemind ? (
            <UbButton
              variant="ghost"
              className={actionButtonClass}
              icon={<UbWhatsAppIcon className="h-5 w-5" />}
              onClick={() => {
                setReminderChannel('whatsapp');
                reminder.openSheet();
              }}
            >
              WhatsApp
            </UbButton>
          ) : (
            <UbStack />
          )}
          {reminder.canRemind ? (
            <UbButton
              variant="ghost"
              className={actionButtonClass}
              icon={<MessageSquare className="h-5 w-5" aria-hidden />}
              onClick={() => {
                setReminderChannel('sms');
                reminder.openSheet();
              }}
            >
              {t('parties.khata.sms')}
            </UbButton>
          ) : (
            <UbStack />
          )}
          {person.mobile ? (
            <UbLink
              href={`tel:${toDialableNumber(person.mobile)}`}
              variant="body-sm"
              className={actionClass}
            >
              <Phone className="h-5 w-5" aria-hidden />
              {t('parties.khata.call')}
            </UbLink>
          ) : (
            <UbStack />
          )}
        </UbStack>
        <PartyLedgerTimeline
          partyId={id}
          book="main"
          title={t('parties.khata.entries')}
          readOnly={detail.isArchived}
          fillHeight
          personal
        />
        {canRecord && mobileLayer && (
          <UbBottomBar
            className="-mx-4 grid shrink-0 grid-cols-2 gap-2 border-t border-border-hairline bg-surface-card px-4 py-3"
            data-testid="khata-dock"
          >
            {pair}
          </UbBottomBar>
        )}
      </UbStack>
      {personForm.open && <PersonForm form={personForm} quickKhata />}
      {entryForm.open && <EntryForm form={entryForm} partyName={person.name} simple />}
      {reminder.open && (
        <Reminder
          partyId={id}
          book="main"
          open
          onOpenChange={reminder.setOpen}
          title={reminder.title}
          description={reminder.description}
          phone={reminder.phone}
          labels={reminder.labels}
          onlyChannel={reminderChannel}
          whatsappIcon={<UbWhatsAppIcon className="h-4 w-4" />}
        />
      )}
    </UbViewportPageShell>
  );
}
