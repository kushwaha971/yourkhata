'use client';

import { useEffect, useState } from 'react';

import { UbBox, UbLink, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';
import { formatInr } from 'src/utils/money';

import { getHomeStrip, type HomeStripKey, type HomeStripTile } from '../api/homeStripService';

const HREF: Record<HomeStripKey, string> = {
  expiring: `${ROUTES.STOCK_EXPIRY}?within=30`,
  phones: ROUTES.ITEM_IMEI,
  soldOutSizes: ROUTES.STOCK_LOW,
};

/**
 * D12 — one strip of the business's own figures under Home's day line
 * (medicine: batches expiring in 30 days; mobile: phones in stock; clothes:
 * sold-out sizes). The server sends a tile only when the business keeps such
 * things, so a kirana sees nothing and Home is unchanged for it. A failed
 * read draws nothing: the strip is extra, the day line is the page.
 */
export function HomeStrip(): React.JSX.Element | null {
  const { t } = useTranslation();
  const [tiles, setTiles] = useState<readonly HomeStripTile[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    getHomeStrip(controller.signal)
      .then(setTiles)
      .catch(() => setTiles([]));
    return () => controller.abort();
  }, []);
  if (tiles.length === 0) return null;
  return (
    <UbBox
      as="section"
      aria-label={t('reports.home.strip.label')}
      data-testid="home-strip"
      className="grid gap-2 lg:gap-3"
      style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
    >
      {tiles.map((tile) => (
        <UbLink
          key={tile.key}
          href={HREF[tile.key]}
          underline={false}
          data-testid={`home-strip-${tile.key}`}
          className="bg-surface grid min-w-0 gap-0.5 rounded-card border border-border-hairline px-3 py-2.5 lg:px-4 lg:py-3"
        >
          <UbText variant="inherit" tone="secondary" className="text-[12px] font-semibold leading-tight [overflow-wrap:anywhere]">
            {t(`reports.home.strip.${tile.key}`)}
          </UbText>
          <UbText
            variant="inherit"
            className="text-[17px] font-extrabold tabular-nums lg:text-[20px]"
          >
            {tile.key === 'expiring'
              ? t('reports.home.strip.expiringValue', { count: tile.count })
              : String(tile.count)}
          </UbText>
          {tile.value !== null && (
            <UbText variant="inherit" tone="secondary" className="text-body-sm [overflow-wrap:anywhere]">
              {t('reports.home.strip.worth', { amount: formatInr(tile.value) })}
            </UbText>
          )}
        </UbLink>
      ))}
    </UbBox>
  );
}
