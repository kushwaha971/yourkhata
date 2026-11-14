'use client';

import { useCallback, useEffect, useState } from 'react';

import { Plus } from 'lucide-react';

import { UbBox, UbButton, UbEmptyState, UbPageHeader, UbPageShell, UbSkeleton, UbStack, UbText, UbTextInput } from 'src/design-system';
import { useAppDispatch, useAppSelector } from 'src/hooks/useAppStore';
import { useIdempotencyKey } from 'src/hooks/useIdempotencyKey';
import { useTranslation } from 'src/hooks/useTranslation';
import { showSnackbar } from 'src/redux/slice/snackbarSlice';
import { toApiError } from 'src/utils/apiError';

import { List } from 'modules/DigiKhaato/features/appParts/AppParts';

import { saveRoute } from '../api/lendingService';
import { useLendingAccess } from '../hooks/useLendingAccess';
import { selectLending } from '../redux/lendingSlice';
import { fetchRoutes } from '../redux/lendingThunks';

/** Routes — the lender's lines ("Market road"); the round and new loans use them. */
export function RoutesPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const lend = useAppSelector(selectLending);
  const { canManage } = useLendingAccess();
  const { key, rotate } = useIdempotencyKey();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => dispatch(fetchRoutes()), [dispatch]);
  useEffect(() => {
    const r = load();
    return () => r.abort();
  }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await saveRoute(name.trim(), undefined, key);
      rotate();
      setName('');
      dispatch(showSnackbar({ severity: 'success', id: 'lending.routes.saved', params: { name: name.trim() } }));
      void load();
    } catch (e) {
      dispatch(showSnackbar({ severity: 'error', message: toApiError(e, 'lending.routes.error').message ?? t('lending.routes.error') }));
    } finally {
      setSaving(false);
    }
  };
  const rows = lend.routes.data ?? [];

  return (
    <UbPageShell>
      <UbStack gap={3} className="pb-24 lg:pb-6">
        <UbPageHeader title={t('lending.routes.title')} subtitle={t('lending.routes.subtitle')} />
        {canManage && (
        <UbStack direction="row" gap={2}>
          <UbTextInput aria-label={t('lending.routes.name')} placeholder={t('lending.routes.name')} value={name} onChange={setName} className="flex-1" />
          <UbButton icon={<Plus className="h-4 w-4" aria-hidden />} busy={saving} disabled={!name.trim()} onClick={() => void add()} data-testid="lending-route-add">
            {t('lending.routes.add')}
          </UbButton>
        </UbStack>
        )}
        {lend.routes.status === 'failed' && !lend.routes.data ? (
          <UbEmptyState variant="error" title={t('lending.routes.error')} action={<UbButton onClick={load}>{t('lending.common.tryAgain')}</UbButton>} />
        ) : !lend.routes.data ? (
          <UbSkeleton variant="list" count={3} label={t('lending.common.loading')} />
        ) : rows.length === 0 ? (
          <UbEmptyState variant="firstUse" title={t('lending.routes.none')} description={t('lending.routes.noneBody')} />
        ) : (
          <List testId="lending-routes-list">
            {rows.map((r) => (
              <UbBox as="li" key={r.id}>
                <UbText variant="inherit" className="block min-h-14 border-b border-border-hairline px-4 py-4 text-[14px] font-medium">
                  {r.name}
                </UbText>
              </UbBox>
            ))}
          </List>
        )}
      </UbStack>
    </UbPageShell>
  );
}
