'use client';

import { UbButton, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

/**
 * A phone report's pages under its cards: Previous · "Page 2 of 14" · Next.
 * The day book and the registers page on the server, a hundred rows at a time.
 */
export function ReportPager({
  page,
  pages,
  onPage,
  label,
}: Readonly<{
  page: number;
  pages: number;
  onPage: (page: number) => void;
  /** "Page 2 of 14", in the report's own words. */
  label: string;
}>): React.JSX.Element | null {
  const { t } = useTranslation();
  if (pages <= 1) return null;
  return (
    <UbStack direction="row" justify="between" align="center" className="gap-2">
      <UbButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {t('common.grid.previousPage')}
      </UbButton>
      <UbText variant="caption" tone="tertiary">
        {label}
      </UbText>
      <UbButton
        variant="secondary"
        size="sm"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        {t('common.grid.nextPage')}
      </UbButton>
    </UbStack>
  );
}
