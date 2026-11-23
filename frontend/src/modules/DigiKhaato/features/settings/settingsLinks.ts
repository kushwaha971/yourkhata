import {
  Building2,
  CalendarDays,
  CreditCard,
  DatabaseBackup,
  History,
  LayoutGrid,
  MessageSquare,
  MonitorSmartphone,
  Palette,
  Store,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { ROUTES } from 'src/routes';

import type { SettingsAccess } from './hooks/useSettingsAccess';

/**
 * Design settings-and-profile S1 (owner-approved 14 Nov 2026) — every Settings
 * row, grouped, for the person signed in. The phone list and the desktop
 * Settings menu both draw from here, so the two can never disagree about who
 * sees what.
 *
 * The rule (S11): a ROLE belongs to a person in one business. Rows about the
 * business follow the role in the business that is open; Your profile, Apps
 * and Devices are the person's own, so nobody sees them as View only. A row a
 * person cannot open is not drawn at all — nobody taps into a dead end.
 */
export type SettingsGroupKey = 'you' | 'apps' | 'business' | 'team' | 'planData';

export interface SettingsLink {
  readonly key: string;
  readonly href: string;
  readonly icon: LucideIcon;
  /** The accountant's business pages: they open, the controls are locked. */
  readonly viewOnly: boolean;
}

export interface SettingsGroup {
  readonly key: SettingsGroupKey;
  readonly links: readonly SettingsLink[];
}

export interface SettingsLinkFlags {
  /** B3 — the Shop's own features, for a business that runs the Shop. */
  readonly runsShop: boolean;
  /** D15 — only a kind whose features add messages of their own. */
  readonly hasOwnMessages: boolean;
  /** A9b — only while an enabled feature reads the business calendar. */
  readonly readsCalendar: boolean;
}

export function settingsGroups(
  access: SettingsAccess,
  flags: SettingsLinkFlags
): readonly SettingsGroup[] {
  const ro = access.canView && !access.canEdit;
  const row = (key: string, href: string, icon: LucideIcon, show: boolean, own = false) =>
    show ? [{ key, href, icon, viewOnly: !own && ro }] : [];
  const groups: SettingsGroup[] = [
    { key: 'you', links: row('me', ROUTES.SETTINGS_ME, UserRound, true, true) },
    { key: 'apps', links: row('apps', ROUTES.APPS, LayoutGrid, true, true) },
    {
      key: 'business',
      links: [
        ...row('profile', ROUTES.SETTINGS_PROFILE, Building2, access.canView),
        ...row(
          'shopFeatures',
          ROUTES.SETTINGS_SHOP_FEATURES,
          Store,
          access.canView && flags.runsShop
        ),
        ...row('branding', ROUTES.SETTINGS_BRANDING, Palette, access.canView),
        ...row(
          'messages',
          ROUTES.SETTINGS_MESSAGES,
          MessageSquare,
          access.canView && flags.hasOwnMessages
        ),
        ...row(
          'businessDays',
          ROUTES.SETTINGS_BUSINESS_DAYS,
          CalendarDays,
          access.canView && flags.readsCalendar
        ),
      ],
    },
    {
      key: 'team',
      links: [
        ...row('team', ROUTES.SETTINGS_TEAM, Users, access.canView || access.canManageTeam),
        ...row('devices', ROUTES.SETTINGS_DEVICES, MonitorSmartphone, true, true),
        ...row('activity', ROUTES.SETTINGS_ACTIVITY, History, access.canReadAudit),
      ],
    },
    {
      key: 'planData',
      links: [
        ...row('plan', ROUTES.SETTINGS_PLAN, CreditCard, access.canView),
        ...row('data', ROUTES.SETTINGS_DATA, DatabaseBackup, access.isOwner),
      ],
    },
  ];
  return groups.filter((group) => group.links.length > 0);
}
