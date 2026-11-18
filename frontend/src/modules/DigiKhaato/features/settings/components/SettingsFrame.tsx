'use client';

import { useMemo, type ReactNode } from 'react';

import { UbLink, UbPageShell, UbPanel, UbStack, UbText } from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveRole, selectActiveTenant, selectEnabledModules } from 'src/redux/slice/sessionSlice';

import { useSettingsAccess } from '../hooks/useSettingsAccess';
import { settingsGroups } from '../settingsLinks';

/**
 * Design settings-and-profile (owner-approved 14 Nov 2026) — the frame every
 * Settings page sits in.
 *
 * Desktop (`dMessages`, S1–S9): "Settings" over the business name and the role
 * the person holds there, the Settings menu on the left — the same rows the
 * phone list shows, from `settingsGroups` — and the page beside it.
 * Phone: a back arrow to the Settings list and the page's own title; the menu
 * is the list itself, one tap back.
 */
export function SettingsFrame({
  page,
  title,
  header,
  wide = false,
  children,
}: Readonly<{
  page: string;
  /** A plain page title (phone only); or */
  title?: string;
  /** the page's own header — title, subtitle and its buttons — beside the menu. */
  header?: ReactNode;
  /** Two-column forms and tables use the full width beside the menu. */
  wide?: boolean;
  children: ReactNode;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  const tenant = useAppSelector(selectActiveTenant);
  const role = useAppSelector(selectActiveRole);
  const features = tenant?.features;
  // Design S3: the accountant opens a business page to read it, and is told so.
  const readOnly = access.canView && !access.canEdit && !['me', 'devices', 'apps'].includes(page);
  const modules = useAppSelector(selectEnabledModules);
  // Business days needs the settings' calendar readers, which only the list
  // and its own page load; the menu shows it while it is the open page.
  const links = useMemo(
    () =>
      settingsGroups(access, {
        runsShop: modules.includes('sales'),
        hasOwnMessages: Boolean(features?.includes('jewellery')),
        readsCalendar: page === 'businessDays',
      }).flatMap((group) => group.links),
    [access, features, modules, page]
  );

  return (
    <UbPageShell>
      <UbStack gap={4}>
        {/* The phone's app bar already carries the back arrow to Settings. */}
        {title !== undefined && !header ? (
          <UbText as="h1" variant="h3" className="lg:hidden">
            {title}
          </UbText>
        ) : null}
        {/* Desktop: "Settings" over the business and the role held there. */}
        <UbStack gap={0.5} className="hidden lg:flex">
          <UbText as="span" variant="h2">
            {t('settings.title')}
          </UbText>
          <UbText as="span" variant="body-sm" tone="secondary">
            {t('settings.frame.signedInAs', {
              business: tenant?.name ?? '',
              role: role ? t(`tenant.role.${role}`) : '',
            })}
          </UbText>
        </UbStack>
        <UbStack className="gap-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <UbStack as="nav" aria-label={t('settings.title')} gap={1} className="hidden lg:flex">
            {links.map((row) => (
              <UbLink
                key={row.key}
                href={row.href}
                variant="inherit"
                tone="primary"
                underline={false}
                aria-current={row.key === page ? 'page' : undefined}
                className={`rounded-lg px-3 py-[9px] text-sm ${row.key === page ? 'bg-accent font-semibold' : ''}`}
              >
                {t(`settings.hub.${row.key}`)}
              </UbLink>
            ))}
          </UbStack>
          <UbStack gap={4} className={wide ? 'min-w-0' : 'min-w-0 max-w-[760px]'}>
            {header}
            {readOnly ? (
              <UbPanel className="bg-surface-sunken p-4">
                <UbText variant="body-sm" tone="secondary">
                  {t('settings.frame.readOnly')}
                </UbText>
              </UbPanel>
            ) : null}
            {children}
          </UbStack>
        </UbStack>
      </UbStack>
    </UbPageShell>
  );
}
