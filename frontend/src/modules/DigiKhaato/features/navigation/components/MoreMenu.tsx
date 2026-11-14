'use client';

import { useMemo, useState } from 'react';

import {
  ArrowLeftRight,
  LogOut,
  MessageSquare,
  MonitorSmartphone,
  ShieldCheck,
} from 'lucide-react';

import { useFeedback } from 'src/analytics/feedback';
import { THEME_MODES, useAccountActions } from 'src/components/layout/useAccountActions';
import {
  UbAvatar,
  UbBox,
  UbMenuList,
  UbSearchInput,
  UbText,
  type UbMenuListRow,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';
import { ROUTES } from 'src/routes';
import { accountContact, accountDisplayName } from 'src/utils/accountIdentity';
import { cn } from 'src/utils/cn';

import { useAppWords } from '../useAppWords';
import { useNavigation } from '../useNavigation';

/**
 * The body of the phone's More: the `/more` page and the App sheet (revamp
 * 04 §2) draw this same list, so the two cannot disagree.
 *
 * docs/mobile-redesign/03 §3 — the phone's More tab: every destination that is
 * not one of the four tabs, in words, grouped exactly as the sidebar groups
 * them, then the business and the person.
 *
 * It is built from the same `useNavigation()` sections the rail renders, so the
 * two can never disagree about what exists or who may open it: a row a role
 * cannot see is not in either. Nothing is invented here; nothing is dropped.
 *
 * "Find a feature" filters the rows by their words, for the long tail a
 * merchant meets once a month and cannot remember the group of.
 */
export function MoreMenu({
  listClassName,
  searchClassName,
}: Readonly<{
  /** The rows' wrapper: a page bleeds them to the screen edge, a sheet does not. */
  listClassName?: string;
  /** The search field's wrapper: a page pads it already, a sheet must. */
  searchClassName?: string;
}>): React.JSX.Element {
  const { t } = useTranslation();
  // B2: the business's own words for its rows and sections.
  const { w } = useAppWords();
  const { sections, bottomNav } = useNavigation();
  const tenant = useAppSelector(selectActiveTenant);
  const feedback = useFeedback();
  const { user, impersonating, locale, options, setLocale, theme, setTheme, signOut } =
    useAccountActions();
  const [query, setQuery] = useState('');

  const tabKeys = useMemo(() => new Set(bottomNav.map((tab) => tab.key)), [bottomNav]);
  const needle = query.trim().toLocaleLowerCase();

  const groups = useMemo(
    () =>
      sections
        .map((section) => ({
          key: section.key,
          title: w(section.labelId),
          rows: section.items
            .filter((item) => !tabKeys.has(item.key))
            .map<UbMenuListRow>((item) => {
              const Icon = item.icon;
              return {
                key: item.key,
                label: w(item.labelId),
                href: item.href,
                icon: <Icon aria-hidden className="h-5 w-5" />,
              };
            })
            .filter((row) => !needle || row.label.toLocaleLowerCase().includes(needle)),
        }))
        .filter((group) => group.rows.length > 0),
    [sections, tabKeys, needle, w]
  );

  const businessRows: UbMenuListRow[] = [
    {
      key: 'switch',
      label: t('nav.workspace.label'),
      caption: tenant?.name,
      href: ROUTES.SWITCH_TENANT,
      icon: <ArrowLeftRight aria-hidden className="h-5 w-5" />,
    },
  ];

  const displayName = user ? accountDisplayName(user) : '';
  const accountRows: UbMenuListRow[] = [
    {
      key: 'devices',
      label: t('sessions.nav'),
      href: ROUTES.SETTINGS_DEVICES,
      icon: <MonitorSmartphone aria-hidden className="h-5 w-5" />,
    },
    ...(feedback
      ? [
          {
            key: 'feedback',
            label: t('feedback.tab.label'),
            onSelect: feedback,
            icon: <MessageSquare aria-hidden className="h-5 w-5" />,
          },
        ]
      : []),
    ...(user?.isSuperAdmin && !impersonating
      ? [
          {
            key: 'console',
            label: t('admin.nav.console'),
            href: ROUTES.ADMIN_TENANTS,
            icon: <ShieldCheck aria-hidden className="h-5 w-5" />,
          },
        ]
      : []),
    {
      key: 'signout',
      label: t('auth.logout.action'),
      tone: 'danger',
      onSelect: () => void signOut(),
      icon: <LogOut aria-hidden className="h-5 w-5" />,
    },
  ];

  return (
    <>
      <UbBox className={searchClassName}>
        <UbSearchInput
          value={query}
          onChange={setQuery}
          placeholder={t('nav.more.search')}
          aria-label={t('nav.more.search')}
        />
      </UbBox>
      <UbBox className={cn('flex flex-col', listClassName)}>
        {groups.map((group) => (
          <UbMenuList key={group.key} title={group.title} rows={group.rows} />
        ))}
        {needle && groups.length === 0 ? (
          <UbText as="p" variant="body" tone="tertiary" className="px-4 py-6">
            {t('nav.more.searchEmpty', { query: query.trim() })}
          </UbText>
        ) : null}

        {!needle && (
          <>
            <UbMenuList title={t('nav.section.business')} rows={businessRows} />

            <UbMenuList
              title={t('nav.more.you')}
              rows={[
                {
                  key: 'who',
                  label: displayName,
                  caption: user?.name ? accountContact(user) || undefined : undefined,
                  icon: <UbAvatar name={displayName || '?'} size="sm" />,
                },
              ]}
            />
            <UbMenuList
              title={t('auth.language.label')}
              selectable
              rows={options.map((option) => ({
                key: option.value,
                label: option.label,
                lang: option.value,
                selected: option.value === locale,
                onSelect: () => setLocale(option.value),
              }))}
            />
            {/* Light or dark, on the phone too: a shop counter at noon and a
                bedside at midnight are not the same screen. */}
            <UbMenuList
              title={t('theme.label')}
              selectable
              rows={THEME_MODES.map((mode) => ({
                key: mode,
                label: t(`theme.${mode}`),
                selected: mode === theme,
                onSelect: () => setTheme(mode),
              }))}
            />
            <UbMenuList rows={accountRows} className="pb-2" />
          </>
        )}
      </UbBox>
    </>
  );
}
