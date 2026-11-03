'use client';

import { useCallback, useState } from 'react';

import {
  UbButton,
  UbEmptyState,
  UbLink,
  UbPageHeader,
  UbPageShell,
  UbPanel,
  UbSkeleton,
  UbStack,
  UbText,
  UbTextArea,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';
import { ROUTES } from 'src/routes';

import { fillMessage } from '../hooks/useKindMessage';
import { useSettingsAccess } from '../hooks/useSettingsAccess';
import { useTenantSettings } from '../hooks/useTenantSettings';

import type { ReminderTemplates } from '../types/settings.types';

type Stored = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** One row of the list. `standardId` is absent where the server holds the default. */
interface MessageDef {
  readonly key: string;
  readonly standardId?: string;
}

/** D15 — a kind's messages come from its features; a new kind adds a line here. */
const MESSAGES_BY_FEATURE: Readonly<Record<string, readonly MessageDef[]>> = {
  jewellery: [
    { key: 'order_ready', standardId: 'sales.customOrder.readyMessageTodayRate' },
    { key: 'payment_reminder' },
    { key: 'todays_rate', standardId: 'stock.rates.shareText' },
  ],
};

const SETTINGS_MENU = [
  { key: 'profile', href: ROUTES.SETTINGS_PROFILE },
  { key: 'shopFeatures', href: ROUTES.SETTINGS_SHOP_FEATURES },
  { key: 'messages', href: ROUTES.SETTINGS_MESSAGES },
  { key: 'team', href: ROUTES.SETTINGS_TEAM },
] as const;

/**
 * D15 — Settings › Messages (design `dMessages`). Only the messages this
 * business's features need. The payment reminder edits the template the
 * reminder renderer already reads, so there is one set of words for it; the
 * others save to `shop.messages`. Nothing is sent from here (DEC-012).
 */
export function MessagesPageContent(): React.JSX.Element {
  const { t, locale } = useTranslation();
  const tenant = useAppSelector(selectActiveTenant);
  const access = useSettingsAccess();
  const settings = useTenantSettings(access.canView);
  const { data, status, error, refetch } = settings;
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const defs = (tenant?.features ?? []).flatMap((feature) => MESSAGES_BY_FEATURE[feature] ?? []);
  const stored = data?.values['shop.messages'] as Stored | undefined;
  const reminder = data?.values['ledger.reminder_templates'] as ReminderTemplates | undefined;
  const lang = locale === 'hi' ? 'hi' : 'en';
  const terms = (data?.values['documents.terms'] as { text?: string } | undefined)?.text;

  const shop = tenant?.name ?? '';
  const sample: Readonly<Record<string, string>> = {
    name: t('settings.messages.sample.name'),
    party_name: t('settings.messages.sample.name'),
    what: t('settings.messages.sample.what'),
    number: 'ORD-0042',
    shop,
    business_name: shop,
    rates: '22K ₹11,650 / g · 24K ₹12,710 / g · Silver ₹150 / g',
    amount: '₹25,000',
    due_date: '30/11/2026',
    upi_link: 'upi://pay?pa=shop@okaxis',
  };

  /** The saved words, placeholders intact; `t` with its own names keeps them so. */
  const wordsOf = useCallback(
    (def: MessageDef): string => {
      if (def.key === 'payment_reminder') return reminder?.[lang] ?? '';
      const keep = {
        name: '{name}',
        what: '{what}',
        number: '{number}',
        shop: '{shop}',
        rates: '{rates}',
      };
      return stored?.[def.key]?.[lang] || t(def.standardId ?? '', keep);
    },
    [reminder, lang, stored, t]
  );

  const save = useCallback(
    async (def: MessageDef, text: string) => {
      const isReminder = def.key === 'payment_reminder';
      const patch = isReminder
        ? { 'ledger.reminder_templates': { en: '', hi: '', ...reminder, [lang]: text } }
        : {
            'shop.messages': {
              ...stored,
              [def.key]: { en: '', hi: '', ...stored?.[def.key], [lang]: text },
            },
          };
      const saved = await settings.saveSection(isReminder ? 'ledger' : 'shop', patch);
      if (saved) setOpen(null);
    },
    [reminder, lang, stored, settings]
  );

  let body: React.ReactNode;
  if (status === 'failed') {
    body = (
      <UbEmptyState
        variant="error"
        title={t('settings.error.title')}
        description={error?.message ?? t('settings.error.body')}
        action={
          <UbButton variant="secondary" onClick={refetch}>
            {t('common.action.retry')}
          </UbButton>
        }
      />
    );
  } else if (!data) {
    body = <UbSkeleton variant="form" count={3} />;
  } else if (defs.length === 0) {
    body = (
      <UbEmptyState
        variant="firstUse"
        title={t('settings.messages.none')}
        description={t('settings.messages.noneBody')}
      />
    );
  } else {
    const shown = defs.find((def) => def.key === selected) ?? (defs[0] as MessageDef);
    const editing = open === shown.key;
    body = (
      <UbStack className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <UbStack gap={2}>
          <UbText variant="body-medium" className="font-semibold">
            {t('settings.messages.heading')}
          </UbText>
          <UbText variant="caption" tone="muted">
            {t('settings.messages.note')}
          </UbText>
          <UbPanel>
            {defs.map((def) => {
              const title = t(`settings.messages.${def.key}`);
              return (
                <UbStack
                  key={def.key}
                  direction="row"
                  justify="between"
                  align="center"
                  gap={2}
                  className={`p-3 ${def.key === shown.key ? 'bg-[var(--primary-50)]' : ''}`}
                >
                  <UbStack gap={0} className="min-w-0">
                    <UbText variant="body-medium" className="font-semibold">
                      {title}
                    </UbText>
                    <UbText variant="caption" tone="muted">
                      {t(`settings.messages.${def.key}.when`)}
                    </UbText>
                  </UbStack>
                  {access.canEdit && (
                    <UbButton
                      variant="ghost"
                      size="sm"
                      aria-label={`${t('settings.messages.edit')} ${title}`}
                      onClick={() => {
                        setSelected(def.key);
                        setDraft(wordsOf(def));
                        setOpen(def.key);
                      }}
                    >
                      {t('settings.messages.edit')}
                    </UbButton>
                  )}
                </UbStack>
              );
            })}
          </UbPanel>
          <UbPanel>
            <UbStack gap={2} className="p-4">
              <UbText variant="body-medium" className="font-semibold">
                {t('settings.messages.print')}
              </UbText>
              <UbStack direction="row" justify="between" gap={3}>
                <UbText variant="body-sm" tone="muted">
                  {t('settings.messages.print.name')}
                </UbText>
                <UbText variant="body-sm">{shop}</UbText>
              </UbStack>
              {terms && (
                <UbStack direction="row" justify="between" gap={3}>
                  <UbText variant="body-sm" tone="muted">
                    {t('settings.messages.print.terms')}
                  </UbText>
                  <UbText variant="body-sm" className="max-w-[60%] text-right">
                    {terms}
                  </UbText>
                </UbStack>
              )}
              <UbStack direction="row" justify="between" gap={3}>
                <UbText variant="body-sm" tone="muted">
                  {t('settings.messages.print.column')}
                </UbText>
                <UbText variant="body-sm">{t('settings.messages.print.columnJewel')}</UbText>
              </UbStack>
            </UbStack>
          </UbPanel>
        </UbStack>
        <UbStack gap={2}>
          <UbText variant="caption" tone="muted">
            {t('settings.messages.preview')} · {t(`settings.messages.${shown.key}`)}
          </UbText>
          {/* WhatsApp's own wallpaper and bubble, as drawn in the design. */}
          <UbStack className="rounded-xl bg-[#ECE5DD] p-3.5">
            <UbText
              variant="body-sm"
              className="justify-self-start whitespace-pre-wrap break-words rounded-lg bg-white p-2.5 text-[#111]"
            >
              {fillMessage(editing ? draft : wordsOf(shown), sample)}
            </UbText>
          </UbStack>
          {editing && (
            <UbTextArea
              aria-label={t('settings.messages.text')}
              value={draft}
              rows={3}
              onChange={setDraft}
            />
          )}
          {editing && (
            <UbStack direction="row" gap={2} justify="end">
              {shown.standardId && (
                <UbButton
                  variant="ghost"
                  size="sm"
                  disabled={!settings.canWrite}
                  onClick={() => void save(shown, '')}
                >
                  {t('settings.messages.standard')}
                </UbButton>
              )}
              <UbButton
                size="sm"
                disabled={!settings.canWrite || settings.savingSection !== null}
                onClick={() => void save(shown, draft)}
              >
                {t('settings.messages.save')}
              </UbButton>
            </UbStack>
          )}
        </UbStack>
      </UbStack>
    );
  }

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('settings.messages.title')}
        subtitle={shop}
      />
      <UbStack className="items-start gap-6 lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* Design `dMessages`: only the rows that have a screen of their own. */}
        <UbStack as="nav" aria-label={t('settings.messages.menu')} gap={1} className="hidden lg:flex">
          {SETTINGS_MENU.map((row) => (
            <UbLink
              key={row.key}
              href={row.href}
              variant="inherit"
              tone="primary"
              underline={false}
              aria-current={row.key === 'messages' ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 ${row.key === 'messages' ? 'bg-[var(--primary-50)] font-semibold' : ''}`}
            >
              {t(`settings.messages.menu.${row.key}`)}
            </UbLink>
          ))}
        </UbStack>
        {body}
      </UbStack>
    </UbPageShell>
  );
}
