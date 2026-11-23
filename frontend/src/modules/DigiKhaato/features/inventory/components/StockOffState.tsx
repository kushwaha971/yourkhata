'use client';

import { UbEmptyState, UbLink, UbPageShell } from 'src/design-system';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';

/**
 * 09 §8.7 States — the stock pages of a business that has switched stock
 * tracking off. It says so in words instead of "you cannot see this", and a
 * member who can open Settings (where the switch is, `ModuleToggleList`) gets
 * the way there. Turning it back on brings every record back; nothing was lost.
 */
export function StockOffState(): React.JSX.Element {
  const { t } = useTranslation();
  const { can } = usePermissions();
  return (
    <UbPageShell>
      <UbEmptyState
        variant="firstUse"
        title={t('stock.off.title')}
        description={t('stock.off.body')}
        action={
          can('platform.audit.read') ? (
            <UbLink href={ROUTES.SETTINGS} data-testid="stock-off-settings">
              {t('stock.off.settings')}
            </UbLink>
          ) : undefined
        }
      />
    </UbPageShell>
  );
}
