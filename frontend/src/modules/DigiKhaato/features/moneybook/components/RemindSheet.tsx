'use client';

import { useEffect, useState } from 'react';

import {
  UbBox,
  UbButton,
  UbChoiceChips,
  UbDrawer,
  UbSkeleton,
  UbStack,
  UbStatusBanner,
  UbText,
  UbTextArea,
} from 'src/design-system';
import { useAppDispatch } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';

import { logReminder, reminderText } from '../api/moneybookService';

import type { Person, ReminderChannel, ReminderTone } from '../types/moneybook.types';

const TONES: readonly ReminderTone[] = ['polite', 'due_date', 'thank_you'];

/** wa.me and sms: links with the owner's own words — nothing is sent by the app (DEC-012). */
export const whatsappHref = (mobile: string, text: string): string =>
  `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}`;
export const smsHref = (mobile: string, text: string): string =>
  `sms:+91${mobile}?body=${encodeURIComponent(text)}`;

/**
 * I3 · Remind. A reminder is the owner's own words in their own WhatsApp or
 * SMS. The text comes from the server in the owner's language and signed with
 * their name; they can change any word. Opening WhatsApp or SMS is logged so
 * the Reminders screen can say "Reminded 2 days ago" — something THEY did.
 */
export function RemindSheet({
  person,
  onClose,
  onAddMobile,
}: Readonly<{ person: Person; onClose: () => void; onAddMobile: () => void }>) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { key, rotate } = useIdempotencyKey();
  const [tone, setTone] = useState<ReminderTone>('polite');
  // The server's words for each kind of message, and the owner's edits to them,
  // both keyed by kind: switching back to Polite keeps what they had typed.
  const [written, setWritten] = useState<Partial<Record<ReminderTone, string>>>({});
  const [edited, setEdited] = useState<Partial<Record<ReminderTone, string>>>({});
  const loading = written[tone] === undefined;
  // The bubble's corner time, as WhatsApp would stamp it now ("4:42 pm").
  const [now] = useState(() =>
    new Date().toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
  );
  const text = edited[tone] ?? written[tone] ?? '';
  const setText = (value: string): void => setEdited((all) => ({ ...all, [tone]: value }));

  useEffect(() => {
    if (written[tone] !== undefined) return undefined;
    const controller = new AbortController();
    reminderText(person.id, tone, controller.signal)
      .then((value) => setWritten((all) => ({ ...all, [tone]: value })))
      .catch(() => undefined);
    return () => controller.abort();
  }, [person.id, tone, written]);

  const open = (channel: ReminderChannel): void => {
    const href =
      channel === 'whatsapp' ? whatsappHref(person.mobile, text) : smsHref(person.mobile, text);
    window.open(href, channel === 'whatsapp' ? '_blank' : '_self', 'noopener');
    void logReminder({ personId: person.id, tone, channel, text, attachedReport: false }, key)
      .then(() => rotate())
      .catch(() => undefined);
    dispatch(
      showSnackbar({
        severity: 'success',
        id: channel === 'whatsapp' ? 'moneybook.remind.opened' : 'moneybook.remind.openedSms',
      })
    );
    onClose();
  };

  const noMobile = !person.mobile;
  return (
    <UbDrawer
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('moneybook.remind.title', { name: person.name.split(' ')[0] ?? person.name })}
      closeLabel={t('moneybook.common.close')}
      keyboardAware
      footer={
        noMobile ? undefined : (
          <UbBox className="grid w-full grid-cols-[1fr_2fr] gap-2.5">
            <UbButton
              variant="secondary"
              size="lg"
              disabled={loading || !text.trim()}
              onClick={() => open('sms')}
            >
              {t('moneybook.remind.sms')}
            </UbButton>
            <UbButton
              size="lg"
              disabled={loading || !text.trim()}
              onClick={() => open('whatsapp')}
              data-testid="moneybook-remind-whatsapp"
            >
              {t('moneybook.remind.whatsapp')}
            </UbButton>
          </UbBox>
        )
      }
    >
      <UbStack gap={3}>
        <UbChoiceChips
          ariaLabel={t('moneybook.remind.tone.label')}
          value={tone}
          onChange={setTone}
          options={TONES.map((value) => ({ value, label: t(`moneybook.remind.tone.${value}`) }))}
        />
        {loading ? (
          <UbSkeleton variant="card" label={t('moneybook.remind.loading')} />
        ) : (
          /* The message as WhatsApp will show it (I3): a green bubble on the chat's
             beige, the time in its corner. Every word is the owner's to change. */
          <UbBox
            className="rounded-xl bg-[#E9E3DA] p-3 dark:bg-surface-sunken"
            data-testid="moneybook-remind-bubble"
          >
            <UbBox className="ml-9 rounded-lg bg-[#D9FDD3] px-3 pb-1.5 pt-2.5 shadow-[0_1px_1px_rgba(0,0,0,0.08)] dark:bg-[#1F3B26]">
              <UbTextArea
                aria-label={t('moneybook.remind.message')}
                value={text}
                onChange={setText}
                rows={4}
                className="[&_textarea]:min-h-[84px] [&_textarea]:resize-none [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:p-0 [&_textarea]:text-[13.5px] [&_textarea]:leading-[1.45] [&_textarea]:text-[#111] [&_textarea]:shadow-none dark:[&_textarea]:text-text-primary"
              />
              <UbText
                variant="inherit"
                className="text-right text-[11px] text-[#667781] dark:text-text-tertiary"
              >
                {now}
              </UbText>
            </UbBox>
          </UbBox>
        )}
        {noMobile && (
          <UbStatusBanner
            tone="info"
            title={t('moneybook.remind.noMobile', { name: person.name })}
            action={
              <UbButton variant="outlineNeutral" size="sm" onClick={onAddMobile}>
                {t('moneybook.remind.addMobile')}
              </UbButton>
            }
          />
        )}
        <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
          {t('moneybook.remind.note')}
        </UbText>
      </UbStack>
    </UbDrawer>
  );
}
