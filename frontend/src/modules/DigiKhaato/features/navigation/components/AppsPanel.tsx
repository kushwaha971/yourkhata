'use client';

import { useEffect, useMemo, useState } from 'react';

import { Check, Plus, Star } from 'lucide-react';

import { UbBox, UbConfirmDialog, UbGrid, UbPressable, UbStack, UbText } from 'src/design-system';
import { MLSpinner } from 'src/design-system/primitives';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant, selectSessionTenants } from 'src/redux/slice/sessionSlice';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { addBusinessPath } from 'src/routes';
import { cn } from 'src/utils/cn';
import { roleLabel } from 'src/utils/roleLabel';
import { clearLocalExceptDrafts } from 'src/utils/storage';

import { APP_MANIFESTS, manifestFor } from 'modules/appManifests';

import { switchTenant } from '../../auth/redux/sessionThunk';
import { draftChanged, resetOnboarding } from '../../onboarding/redux/onboardingSlice';
import { fetchAppsPerBusiness } from '../../tenant-switcher/api/tenantSwitcherService';
import { setDefaultTenant } from '../../tenant-switcher/redux/tenantSwitcherThunk';
import { appPlace } from '../appPlace';
import { useNavigation } from '../useNavigation';

/**
 * The person's own apps: one book per person, not per business (owner, 12 Nov
 * 2026), so they get no list of places, no ★ and no "+ Add".
 */
const PERSONAL_APPS: ReadonlySet<string> = new Set(['khata']);
/** Apps with their own words for "Your …" and "Add …"; any other says "place". */
const WORDED: ReadonlySet<string> = new Set(['shop', 'library', 'lending']);
const wordOf = (code: string): string => (WORDED.has(code) ? code : 'any');
/** Apps with a one-line "what it is for" under their name (design: the Apps canvas). */
const ABOUT: ReadonlySet<string> = new Set(['shop', 'khata', 'library', 'lending']);

const CARD =
  'relative flex min-h-[88px] flex-col items-start justify-between gap-2 rounded-card p-3 text-left active:scale-[0.98] motion-reduce:active:scale-100';

interface Place {
  readonly tenantId: string;
  readonly membershipId: string | null;
  readonly name: string;
  readonly open: boolean;
  readonly primary: boolean;
  /** Owner / Staff / … — what this person is there. */
  readonly role: string;
}

/**
 * The Apps screen (owner, 12 Nov 2026; design: the "Apps and primary place"
 * canvas). Every app this person can open in ANY of their businesses as a card,
 * the open one highlighted; under the chosen app, the businesses ("places")
 * where they can open it — the open one ticked, one ★ Primary that sign-in
 * opens — and "+ Add …". It replaces the business switch that sat at the top of
 * the side menu and the phone header: choosing where to work is here, once.
 *
 * A card opens its app at once (its ★ place, else the one open now, else the
 * first); a place opens that business in this app. The ★ only chooses what the
 * next sign-in opens (`primary_app`), so it never moves the person.
 *
 * Opening a place in ANOTHER business asks first (owner, 14 Nov 2026): every
 * figure on every screen changes with it, so the dialog names the business the
 * person is in, the one they are going to and the app that opens there.
 * Another app of the same business opens at once, as before. There is no
 * "Turn off" or "Leave" here (same day): where you work changes by switching.
 */
export function AppsPanel({ onLeave }: Readonly<{ onLeave?: () => void }>): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const router = useAppRouter();
  const { apps: here, app: current } = useNavigation();
  const active = useAppSelector(selectActiveTenant);
  const tenants = useAppSelector(selectSessionTenants);
  const [chosen, setChosen] = useState<string | null>(current ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ readonly tenantId: string; readonly code: string } | null>(null);
  // Which apps each business opens, from its own request; until it answers (or
  // if it cannot), the open business's apps alone, which the session holds.
  const [appsOf, setAppsOf] = useState<Readonly<Record<string, readonly string[]>>>({});
  useEffect(() => {
    const controller = new AbortController();
    fetchAppsPerBusiness(controller.signal)
      .then(setAppsOf)
      .catch(() => undefined);
    return () => controller.abort();
  }, [tenants]);

  const usable = useMemo(() => tenants.filter((row) => (row.status ?? 'active') === 'active'), [tenants]);
  // Apps across every business; an older session without
  // `apps` on its rows still shows the open business's apps.
  const codes = useMemo(() => {
    // The open business's apps first, in the server's order; then apps only
    // another business runs, in manifest order.
    const elsewhere = new Set<string>();
    usable.forEach((row) => (appsOf[row.id] ?? []).forEach((code) => elsewhere.add(code)));
    const first = here.map((a) => a.code);
    return [...first, ...APP_MANIFESTS.map((m) => m.code).filter((code) => elsewhere.has(code) && !first.includes(code))];
  }, [appsOf, here, usable]);
  const view = chosen && codes.includes(chosen) ? chosen : (current ?? codes[0] ?? null);

  const placesOf = (code: string): Place[] =>
    usable
      .filter((row) => (appsOf[row.id] ?? []).includes(code) || (row.id === active?.id && here.some((a) => a.code === code)))
      .map((row) => ({
        tenantId: row.id,
        membershipId: row.membershipId ?? null,
        name: row.name,
        open: row.id === active?.id && code === current,
        primary: Boolean(row.isDefault) && row.primaryApp === code,
        role: row.role ? roleLabel(t, row.role) : '',
      }));

  const homeOf = (code: string): string =>
    here.find((a) => a.code === code)?.href ?? manifestFor(code)?.navigation[0]?.href ?? '/';

  const openPlace = async (tenantId: string, code: string): Promise<void> => {
    if (busy) return;
    if (tenantId === active?.id) {
      if (code === current) return;
      onLeave?.();
      router.push(appPlace(tenantId, code, homeOf(code)));
      return;
    }
    // Another business: every screen will show its records, so ask first.
    setAsking({ tenantId, code });
  };

  const switchTo = async (tenantId: string, code: string): Promise<void> => {
    if (busy) return;
    setBusy(`${tenantId}:${code}`);
    try {
      const session = await dispatch(switchTenant({ tenantId })).unwrap();
      // §19.6.5 step 4, as the business menu did: drafts survive, the rest goes.
      clearLocalExceptDrafts();
      dispatch(
        showSnackbar({
          severity: 'success',
          id: 'tenant.switcher.switched',
          params: { name: session.activeTenant?.name ?? '' },
        })
      );
      onLeave?.();
      router.push(homeOf(code));
    } catch {
      dispatch(showSnackbar({ severity: 'error', id: 'tenant.apps.openError' }));
    } finally {
      setBusy(null);
      setAsking(null);
    }
  };

  const openApp = (code: string): void => {
    setChosen(code);
    const places = placesOf(code);
    if (PERSONAL_APPS.has(code) || places.length === 0) {
      void openPlace(active?.id ?? '', code);
      return;
    }
    const target = places.find((p) => p.primary) ?? places.find((p) => p.tenantId === active?.id) ?? places[0];
    if (target) void openPlace(target.tenantId, code);
  };

  const star = async (place: Place, code: string): Promise<void> => {
    if (!place.membershipId || place.primary || busy) return;
    setBusy(`star:${place.tenantId}`);
    try {
      await dispatch(setDefaultTenant({ membershipId: place.membershipId, primaryApp: code })).unwrap();
      dispatch(showSnackbar({ severity: 'success', id: 'tenant.apps.primarySet', params: { name: place.name } }));
    } catch {
      dispatch(showSnackbar({ severity: 'error', id: 'tenant.apps.primaryError' }));
    } finally {
      setBusy(null);
    }
  };

  const addPlace = (code: string): void => {
    dispatch(resetOnboarding());
    // "+ Add library" starts the new business with the Library already ticked
    // on step 1 ("What do you want to use?"); the owner can still change it.
    dispatch(draftChanged({ apps: [code] }));
    onLeave?.();
    router.push(addBusinessPath());
  };

  const places = view && !PERSONAL_APPS.has(view) ? placesOf(view) : [];
  const askingName = usable.find((row) => row.id === asking?.tenantId)?.name ?? '';

  return (
    <UbStack gap={4} data-testid="apps-panel">
      <UbText as="h2" variant="label" tone="tertiary">
        {t('tenant.apps.yourApps')}
      </UbText>
      <UbGrid columns={{ base: 2, sm: 4 }} gap={2} data-testid="app-sheet-tiles">
        {codes.map((code) => {
          const manifest = manifestFor(code);
          const Icon = manifest?.icon;
          const on = code === view;
          const isOpen = code === current;
          return (
            <UbPressable
              key={code}
              selected={on}
              aria-busy={busy?.endsWith(`:${code}`) || undefined}
              data-testid={`apps-card-${code}`}
              onClick={() => openApp(code)}
              className={cn(
                CARD,
                on
                  ? 'border-2 border-action bg-primary-50 text-text-primary'
                  : 'border border-border-hairline bg-surface-card text-text-primary active:bg-surface-active'
              )}
            >
              {Icon && <Icon aria-hidden className="h-5 w-5" strokeWidth={on ? 2 : 1.75} />}
              <UbStack gap={0} className="min-w-0">
                <UbText as="span" variant="body-medium" tone="inherit" className="break-words">
                  {t(manifest?.labelId ?? code)}
                </UbText>
                <UbText as="span" variant="caption" tone="secondary" className="break-words">
                  {isOpen ? t('tenant.apps.openNow') : ABOUT.has(code) ? t(`tenant.apps.about.${code}`) : ''}
                </UbText>
              </UbStack>
              {isOpen && <Check aria-hidden className="absolute right-3 top-3 h-4 w-4" strokeWidth={2.5} />}
            </UbPressable>
          );
        })}
      </UbGrid>

      {view && PERSONAL_APPS.has(view) && (
        <UbBox className="flex items-center gap-3 rounded-card border border-border-hairline bg-surface-subtle p-3.5">
          <Check aria-hidden className="h-5 w-5 shrink-0 text-action" strokeWidth={2.5} />
          <UbStack gap={0}>
            <UbText as="span" variant="body-medium">
              {t('tenant.apps.personal.title')}
            </UbText>
            <UbText as="span" variant="caption" tone="secondary">
              {t('tenant.apps.personal.body')}
            </UbText>
          </UbStack>
        </UbBox>
      )}

      {view && !PERSONAL_APPS.has(view) && (
        <UbStack gap={2}>
          <UbText as="h2" variant="label" tone="tertiary">
            {t(`tenant.apps.places.${wordOf(view)}`)}
          </UbText>
          <UbBox className="overflow-hidden rounded-card border border-border-hairline bg-surface-card" data-testid="apps-places">
            {places.map((place) => (
              <UbBox
                key={place.tenantId}
                className={cn(
                  'flex items-center gap-2 border-b border-border-hairline pl-3.5 pr-1',
                  place.open && 'bg-surface-subtle'
                )}
              >
                <UbPressable
                  onClick={() => void openPlace(place.tenantId, view)}
                  aria-current={place.open ? 'true' : undefined}
                  data-testid="apps-place"
                  className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <UbBox
                    as="span"
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      place.open ? 'bg-action text-text-inverse' : 'border-2 border-border-strong'
                    )}
                  >
                    {place.open && <Check aria-hidden className="h-3 w-3" strokeWidth={3} />}
                  </UbBox>
                  <UbStack gap={0} className="min-w-0">
                    <UbText as="span" variant="body-medium" className="break-words">
                      {place.name}
                    </UbText>
                    <UbText as="span" variant="caption" tone="secondary" className="break-words">
                      {[place.role, place.open && t('tenant.apps.openNow'), place.primary && t('tenant.apps.primary')]
                        .filter(Boolean)
                        .join(' · ')}
                    </UbText>
                  </UbStack>
                  {busy === `${place.tenantId}:${view}` && <MLSpinner />}
                </UbPressable>
                <UbPressable
                  onClick={() => void star(place, view)}
                  aria-pressed={place.primary}
                  aria-label={t(place.primary ? 'tenant.apps.primaryLabel' : 'tenant.apps.makePrimary', { name: place.name })}
                  disabled={!place.membershipId}
                  data-testid="apps-star"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                >
                  {busy === `star:${place.tenantId}` ? (
                    <MLSpinner />
                  ) : (
                    <Star
                      aria-hidden
                      className={cn('h-5 w-5', place.primary ? 'fill-warning text-warning' : 'text-text-tertiary')}
                      strokeWidth={1.75}
                    />
                  )}
                </UbPressable>
              </UbBox>
            ))}
            <UbPressable
              onClick={() => addPlace(view)}
              data-testid="apps-add"
              className="flex min-h-[48px] w-full items-center gap-2 px-3.5 text-left text-action"
            >
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2.25} />
              <UbText as="span" variant="body-medium" tone="inherit">
                {t(`tenant.apps.add.${wordOf(view)}`)}
              </UbText>
            </UbPressable>
          </UbBox>
          <UbText as="p" variant="caption" tone="secondary">
            {t('tenant.apps.hint')}
          </UbText>
        </UbStack>
      )}
      <UbConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => !open && !busy && setAsking(null)}
        title={t('tenant.apps.switch.title', { business: askingName })}
        // Where they are, where they are going and what changes, before the act.
        description={t('tenant.apps.switch.body', {
          from: active?.name ?? '',
          app: asking ? t(manifestFor(asking.code)?.labelId ?? asking.code) : '',
          business: askingName,
        })}
        confirmLabel={t('tenant.apps.switch.confirm')}
        cancelLabel={t('common.action.cancel')}
        closeLabel={t('common.action.dismiss')}
        onConfirm={() => asking && void switchTo(asking.tenantId, asking.code)}
        busy={busy !== null}
        busyLabel={t('tenant.apps.switch.busy')}
        // A switch loses nothing and is undone by switching back: no warning look.
        destructive={false}
      />
    </UbStack>
  );
}
