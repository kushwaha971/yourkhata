'use client';

import { useEffect, useState } from 'react';

import { UbSelect, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { listSites, type ContractorSite } from '../api/siteService';

/** G7 — "Which site?", asked only for a contractor with more than one. With one,
 *  the server takes it; a bill may also wait with none chosen. */
export function BillSitePicker({
  partyId,
  value,
  onChange,
}: Readonly<{ partyId: string; value: string; onChange: (siteId: string) => void }>): React.JSX.Element | null {
  const { t } = useTranslation();
  const [sites, setSites] = useState<readonly ContractorSite[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    listSites({ party: partyId }, controller.signal)
      .then((next) => setSites(next.sites))
      .catch(() => setSites([]));
    return () => controller.abort();
  }, [partyId]);

  if (sites.length < 2) return null;
  return (
    <UbStack gap={1} data-testid="bill-site">
      <UbText variant="body-sm" className="font-semibold">{t('sales.site.which')}</UbText>
      <UbSelect
        aria-label={t('sales.site.which')}
        value={value}
        onChange={onChange}
        placeholder={t('sales.site.choose')}
        options={sites.map((site) => ({ value: site.id, label: site.name }))}
      />
    </UbStack>
  );
}
