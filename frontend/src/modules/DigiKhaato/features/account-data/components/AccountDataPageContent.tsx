'use client';

import {
  UbButton,
  UbDisclosure,
  UbEmptyState,
  UbPageHeader,
  UbSkeleton,
  UbStack,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveRole } from 'src/redux/slice/sessionSlice';

import { SettingsFrame } from 'modules/DigiKhaato/features/settings/components/SettingsFrame';

import { useAccountData } from '../hooks/useAccountData';

import { AccountDataIntlProvider } from './AccountDataIntlProvider';
import { DataExportPanel } from './DataExportPanel';
import { DeleteBusinessPanel } from './DeleteBusinessPanel';
import { SupportAccessPanel } from './SupportAccessPanel';

function OwnerDataPage(): React.JSX.Element {
  const { t } = useTranslation();
  const data = useAccountData();

  if (data.status === 'failed') {
    return (
      <UbEmptyState
        variant="error"
        title={t('data.error.title')}
        description={data.error?.message ?? t('data.error.body')}
        requestId={data.error?.requestId ?? null}
        requestIdLabel={t('common.error.reference')}
        action={
          <UbButton variant="secondary" onClick={data.refetch}>
            {t('common.action.retry')}
          </UbButton>
        }
      />
    );
  }
  if (!data.deletion) return <UbSkeleton variant="form" count={3} />;
  const supportNeedsOwner = data.support.some((row) => row.status === 'requested' || row.status === 'granted');

  return (
    <UbStack gap={4}>
      {/* Design S9: download, then delete; support access, which the design has
          no place for, stays closed below (owner: "build to the design"). */}
      <DataExportPanel data={data} />
      <DeleteBusinessPanel data={data} />
      {/* Opens by itself while support is waiting for the owner's answer, or
          while an access is live: neither may sit behind a closed section. */}
      <UbDisclosure
        label={t('data.more.title')}
        hint={t('data.more.hint')}
        // Re-made when one arrives, so it opens even though the list loads later.
        key={supportNeedsOwner ? 'open' : 'closed'}
        defaultOpen={supportNeedsOwner}
      >
        <SupportAccessPanel data={data} />
      </UbDisclosure>
    </UbStack>
  );
}

/**
 * PLT-10 — Settings → Your data (owner only, FRD §12). Three things a business
 * owner can do with the business itself: take everything away as a file, let
 * support in for a day (PLT-14's consent), and delete it with thirty days to
 * change their mind.
 *
 * The role is checked by NAME, not by permission — an admin holds
 * `platform.tenant.manage` and must still be told no; the server refuses them
 * too, this only spares them a page of 403s.
 */
export function AccountDataPageContent(): React.JSX.Element {
  return (
    <AccountDataIntlProvider>
      <AccountDataPage />
    </AccountDataIntlProvider>
  );
}

function AccountDataPage(): React.JSX.Element {
  const { t } = useTranslation();
  const role = useAppSelector(selectActiveRole);
  const header = <UbPageHeader title={t('data.title')} subtitle={t('data.subtitle')} />;

  return (
    <SettingsFrame page="data" header={header}>
      {role === 'owner' ? (
        <OwnerDataPage />
      ) : (
        <UbEmptyState
          variant="firstUse"
          title={t('data.ownerOnly.title')}
          description={t('data.ownerOnly.body')}
        />
      )}
    </SettingsFrame>
  );
}
