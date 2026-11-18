'use client';

import { useMemo, useState } from 'react';

import {
  UbEmptyState,
  UbLink,
  UbPageHeader,
  UbPageShell,
  UbSearchInput,
  UbStack,
  UbText,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';

import {
  REPORT_CATALOGUE,
  visibleReports,
} from '../constants/reportCatalogue';

/**
 * `/reports` — the index of reports this reader can open (RPT-common:
 * "index of reports by permission"), the design's one list: the report's name
 * and, beside it, the question it answers, since a shopkeeper knows the question
 * and not that its answer is called a day book. Search matches either. Every row
 * is a built screen; one its reader may not open is not listed at all.
 */
export function ReportsHubPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const { can, hasModule } = usePermissions();
  const features = useAppSelector(selectActiveTenant)?.features;
  const visible = useMemo(
    () => visibleReports(REPORT_CATALOGUE, can, hasModule, features ?? []),
    [can, hasModule, features]
  );

  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const rows = visible
    .map((entry) => ({
      key: entry.key,
      href: entry.href,
      name: t(`reports.shell.hub.${entry.key}.title`),
      question: t(`reports.shell.hub.${entry.key}.question`),
    }))
    .filter((row) => `${row.name} ${row.question}`.toLowerCase().includes(needle));

  return (
    <UbPageShell>
      <UbPageHeader
        title={t('reports.shell.hub.title')}
        subtitle={t('reports.shell.hub.description')}
      />
      {visible.length === 0 ? (
        <UbEmptyState
          variant="firstUse"
          title={t('reports.shell.hub.empty.title')}
          description={t('reports.shell.hub.empty.body')}
        />
      ) : (
        <UbStack
          gap={0}
          data-testid="reports-hub"
          className="overflow-hidden rounded-card border border-border-hairline bg-surface-card"
        >
          <UbStack className="border-b border-border-hairline p-3">
            <UbSearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('reports.shell.hub.search')}
              aria-label={t('reports.shell.hub.search')}
            />
          </UbStack>
          {rows.length === 0 ? (
            <UbStack className="p-6">
              <UbText variant="body-sm" tone="secondary">
                {t('reports.shell.hub.noMatch')}
              </UbText>
            </UbStack>
          ) : (
            rows.map(({ key, href, name, question }) => (
              /* The name's link covers the row: one row, one target. */
              <UbStack
                key={key}
                className="relative border-b border-border-hairline px-[14px] py-2.5 last:border-b-0 hover:bg-surface-hover lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-center"
              >
                <UbLink
                  href={href}
                  variant="body-sm"
                  aria-label={t('reports.shell.hub.link', { question, name })}
                  className="text-text-primary no-underline after:absolute after:inset-0 after:content-[''] max-lg:font-medium"
                >
                  {name}
                </UbLink>
                <UbText variant="body-sm" tone="secondary">
                  {question}
                </UbText>
              </UbStack>
            ))
          )}
        </UbStack>
      )}
    </UbPageShell>
  );
}
