'use client';

import { useEffect, useState } from 'react';

import { UbBox, UbLink, UbText } from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';
import { ROUTES } from 'src/routes';
import { formatInr } from 'src/utils/money';

import { getJewelHome, type JewelHome } from '../api/jewelService';

import 'src/i18n/catalogues/sales';

/** D12 for a jeweller: today's 22K rate, custom orders due, old gold taken. */
export function JewelHomeStrip(): React.JSX.Element | null {
  const { t } = useTranslation();
  const jeweller = Boolean(useAppSelector(selectActiveTenant)?.features?.includes('jewellery'));
  const [data, setData] = useState<JewelHome | null>(null);
  useEffect(() => {
    if (!jeweller) return undefined;
    const controller = new AbortController();
    getJewelHome(controller.signal)
      .then(setData)
      .catch(() => setData(null));
    return () => controller.abort();
  }, [jeweller]);
  if (!data) return null;
  const tiles = [
    {
      key: 'rate',
      href: ROUTES.STOCK_RATES,
      label: t('sales.jewelHome.rate'),
      value: data.gold_22k ? `${formatInr(data.gold_22k).replace(/\.00$/, '')}/g` : t('sales.jewelHome.rateNotSet'),
      sub: data.silver ? t('sales.jewelHome.silver', { rate: formatInr(data.silver) }) : '',
    },
    {
      key: 'orders',
      href: ROUTES.SALES_CUSTOM_ORDERS,
      label: t('sales.jewelHome.orders'),
      value: String(data.orders_due),
      sub: t('sales.jewelHome.withKarigar', { n: data.orders_with_karigar }),
    },
    {
      key: 'oldGold',
      href: ROUTES.SALES_OLD_GOLD,
      label: t('sales.jewelHome.oldGold'),
      value: `${Number(data.old_gold_month_g).toFixed(1)} g`,
      sub: t('sales.jewelHome.thisMonth'),
    },
  ];
  return (
    <UbBox
      as="section"
      aria-label={t('sales.jewelHome.label')}
      data-testid="jewel-home"
      className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3 lg:gap-3"
    >
      {tiles.map((tile) => (
        <UbLink
          key={tile.key}
          href={tile.href}
          underline={false}
          data-testid={`jewel-home-${tile.key}`}
          className="grid min-h-[86px] min-w-0 gap-0.5 rounded-card border border-border-hairline bg-surface-card px-3 py-2.5 leading-[1.45] text-text-primary lg:min-h-[95px] lg:px-4 lg:py-3"
        >
          <UbText
            variant="inherit"
            tone="tertiary"
            className="text-[12px] font-semibold"
          >
            {tile.label}
          </UbText>
          <UbText
            variant="inherit"
            className="break-words text-[17px] font-extrabold leading-[1.45] tabular-nums lg:text-[20px]"
          >
            {tile.value}
          </UbText>
          {tile.sub && (
            <UbText variant="inherit" tone="tertiary" className="text-[12.5px]">
              {tile.sub}
            </UbText>
          )}
        </UbLink>
      ))}
    </UbBox>
  );
}
