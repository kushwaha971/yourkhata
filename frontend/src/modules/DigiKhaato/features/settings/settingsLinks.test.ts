import { settingsGroups } from './settingsLinks';

/**
 * Design settings-and-profile S1/S11 — who sees which Settings row. Prevents:
 * a staff member tapping into business pages that only refuse them, an
 * accountant's own profile or Apps marked "View only", and Your data offered
 * to an admin.
 */
const flags = { runsShop: true, hasOwnMessages: false, readsCalendar: true };
const access = (role: 'owner' | 'admin' | 'accountant' | 'staff') => ({
  canView: role !== 'staff',
  canEdit: role === 'owner' || role === 'admin',
  canEditBranding: role === 'owner' || role === 'admin',
  canReadAudit: role !== 'staff',
  canManageTeam: role === 'owner' || role === 'admin',
  isOwner: role === 'owner',
});
const keys = (role: Parameters<typeof access>[0]) =>
  settingsGroups(access(role), flags).flatMap((g) => g.links.map((l) => `${l.key}${l.viewOnly ? '*' : ''}`));

it('the owner sees every row, none view only', () => {
  expect(keys('owner')).toEqual(['me', 'apps', 'profile', 'shopFeatures', 'branding', 'businessDays', 'team', 'devices', 'activity', 'plan', 'data']);
});

it('an admin sees everything but Your data', () => {
  expect(keys('admin')).not.toContain('data');
  expect(keys('admin')).toContain('plan');
});

it("the accountant's business pages are view only; profile, Apps and devices are their own", () => {
  expect(keys('accountant')).toEqual(['me', 'apps', 'profile*', 'shopFeatures*', 'branding*', 'businessDays*', 'team*', 'devices', 'activity*', 'plan*', 'data*'].filter((k) => k !== 'data*'));
});

it('staff see only their profile, Apps and devices', () => {
  expect(keys('staff')).toEqual(['me', 'apps', 'devices']);
});
