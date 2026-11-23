'use client';

import { useCallback, useMemo } from 'react';

import { ChevronRight } from 'lucide-react';

import {
  UbAvatar,
  UbBox,
  UbButton,
  UbConfirmDialog,
  UbDisclosure,
  UbEmptyState,
  UbLink,
  UbPageHeader,
  UbPageShell,
  UbPanel,
  UbSkeleton,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import {
  selectActiveRole,
  selectActiveTenant,
  selectSessionUser,
} from 'src/redux/slice/sessionSlice';
import { ROUTES } from 'src/routes';
import { formatPhoneForDisplay } from 'src/utils/share';

import { useSettingsAccess } from '../hooks/useSettingsAccess';
import { useTenantSettings } from '../hooks/useTenantSettings';
import { settingsGroups } from '../settingsLinks';

import { LedgerSettingsSection } from './LedgerSettingsSection';
import { ModuleToggleList } from './ModuleToggleList';

/**
 * PLT-06 — Settings. The page is two things: the doors to the business's own
 * records (profile, branding, team, plan, activity, devices), and the tenant
 * settings that have a consumer in the product today.
 *
 * ── What is NOT on this page yet, and why ───────────────────────────────────
 * FR-1 also lists Documents (numbering, due days, bill terms, the UPI QR),
 * Stock and Party labels. The server stores and validates every one of them
 * (`GET/PUT /tenants/current/settings` round-trips the whole object, numbering
 * included), but nothing in the product READS them yet — there are no bills,
 * no stock screens and no party-label copy. A switch whose effect nobody can
 * see teaches a merchant the product is broken (docs/DESIGN-SYSTEM.md §5), so
 * those sections join this page with the features that consume them.
 */
export function SettingsPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  const settings = useTenantSettings(access.canView);
  const { data, status, error, refetch } = settings;

  const runsShop = data?.modules.enabled.includes('sales') ?? false;
  const calendarReaders = data?.calendarReaders;
  const hasOwnMessages = Boolean(
    useAppSelector(selectActiveTenant)?.features?.includes('jewellery')
  );
  const groups = useMemo(
    () =>
      settingsGroups(access, {
        runsShop,
        hasOwnMessages,
        readsCalendar: (calendarReaders?.length ?? 0) > 0,
      }),
    [access, calendarReaders, hasOwnMessages, runsShop]
  );
  const user = useAppSelector(selectSessionUser);
  const role = useAppSelector(selectActiveRole);
  const tenantName = useAppSelector(selectActiveTenant)?.name ?? '';
  const isStaff = !access.canView;

  const handleConflictOpenChange = useCallback(
    (next: boolean) => {
      if (!next) settings.reloadAfterConflict();
    },
    [settings]
  );
  const handleModules = useCallback(
    (modules: readonly string[]) => void settings.setModules(modules),
    [settings]
  );

  const header = <UbPageHeader title={t('settings.title')} />;

  let sections: React.ReactNode = null;
  if (!access.canView) {
    sections = null;
  } else if (status === 'failed') {
    sections = (
      <UbEmptyState
        variant="error"
        title={t('settings.error.title')}
        description={error?.message ?? t('settings.error.body')}
        requestId={error?.requestId ?? null}
        requestIdLabel={t('common.error.reference')}
        action={
          <UbButton variant="secondary" onClick={refetch}>
            {t('common.action.retry')}
          </UbButton>
        }
      />
    );
  } else if (!data) {
    sections = <UbSkeleton variant="form" count={4} />;
  } else {
    // The design's Settings list stops at its groups (owner: "build to the
    // design", 16 Nov 2026). The Money Book reminder settings and the feature
    // switches it has no place for are kept, closed, under More settings.
    sections = (
      <UbDisclosure label={t('settings.more.title')} hint={t('settings.more.hint')}>
        <UbStack gap={4}>
          <LedgerSettingsSection settings={settings} canEdit={access.canEdit} />
          <ModuleToggleList
            modules={data.modules}
            canEdit={access.canEdit}
            busy={settings.isTogglingModules || !settings.canWrite}
            onChange={handleModules}
            refusal={settings.moduleRefusal}
          />
        </UbStack>
      </UbDisclosure>
    );
  }

  return (
    <UbPageShell header={header} width="measure">
      <UbStack gap={4}>
        {/* Design S1 — the card at the top opens Your profile. */}
        <UbLink
          href={ROUTES.SETTINGS_ME}
          variant="inherit"
          underline={false}
          className="flex min-h-16 items-center gap-3 rounded-lg border border-border-hairline bg-surface-card px-4 py-3"
        >
          <UbAvatar name={user?.name ?? ''} size="md" />
          <UbStack gap={0.5} className="min-w-0 flex-1">
            <UbText as="span" variant="body-medium" className="break-words">
              {user?.name}
            </UbText>
            <UbText as="span" variant="caption" tone="tertiary" className="break-words">
              {[
                user?.mobile ? formatPhoneForDisplay(user.mobile) : null,
                role ? t(`tenant.role.${role}`) : null,
                tenantName,
              ]
                .filter(Boolean)
                .join(' · ')}
            </UbText>
          </UbStack>
          <UbText as="span" variant="body-medium" tone="primary" className="shrink-0">
            {t('settings.hub.me')}
          </UbText>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-text-tertiary" />
        </UbLink>
        {groups
          .filter((group) => group.key !== 'you')
          .map((group) => (
            <UbStack
              as="section"
              gap={2}
              key={group.key}
              aria-label={t(`settings.group.${group.key}`)}
            >
              <UbText as="h2" variant="label-caps" tone="secondary" className="px-1">
                {t(`settings.group.${group.key}`)}
              </UbText>
              <UbPanel>
                <UbStack as="ul" gap={0}>
                  {group.links.map((link) => (
                    <UbBox
                      as="li"
                      key={link.key}
                      className="border-b border-border-subtle last:border-0"
                    >
                      <UbLink
                        href={link.href}
                        variant="inherit"
                        tone="primary"
                        underline={false}
                        className="flex min-h-14 items-center gap-3 px-4 py-2"
                      >
                        <link.icon aria-hidden className="h-5 w-5 shrink-0 text-text-secondary" />
                        <UbStack gap={0.5} className="min-w-0 flex-1">
                          <UbText as="span" variant="body-medium">
                            {t(`settings.hub.${link.key}`)}
                          </UbText>
                          <UbText as="span" variant="caption" tone="tertiary">
                            {t(`settings.hub.${link.key}.description`)}
                          </UbText>
                        </UbStack>
                        {link.viewOnly ? (
                          <UbStatusBadge label={t('settings.hub.viewOnly')} tone="neutral" />
                        ) : null}
                        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-text-tertiary" />
                      </UbLink>
                    </UbBox>
                  ))}
                </UbStack>
              </UbPanel>
            </UbStack>
          ))}
        {isStaff ? (
          <UbPanel className="bg-surface-sunken p-4">
            <UbText variant="body" tone="secondary">
              {t('settings.hub.staffNote')}
            </UbText>
          </UbPanel>
        ) : null}
        {sections}
      </UbStack>

      <UbConfirmDialog
        open={settings.conflict}
        onOpenChange={handleConflictOpenChange}
        title={t('settings.conflict.title')}
        description={t('settings.conflict')}
        confirmLabel={t('settings.conflict.reload')}
        cancelLabel={t('common.action.cancel')}
        closeLabel={t('common.action.close')}
        onConfirm={settings.reloadAfterConflict}
      />
    </UbPageShell>
  );
}
