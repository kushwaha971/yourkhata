'use client';

import { useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { Printer } from 'lucide-react';

import {
  UbBox,
  UbButton,
  UbChoiceChips,
  UbEmptyState,
  UbPageHeader,
  UbPageShell,
  UbPanel,
  UbQuantityInput,
  UbStack,
  UbSwitch,
  UbText,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectActiveTenant } from 'src/redux/slice/sessionSlice';
import { formatInr } from 'src/utils/money';

import { getPurchaseBill } from '../../purchases/api/purchaseBillService';
import { getItem } from '../api/itemService';

import { BarcodeLabel } from './BarcodeLabel';
import { ItemQuickAdd } from './ItemQuickAdd';

interface LabelRow {
  readonly itemId: string;
  readonly name: string;
  readonly code: string;
  readonly price: string;
  readonly count: string;
}

type LabelSize = 'roll' | 'sheet';

/**
 * D P2 — Print labels (design D9). From an item (`?item=`) or straight after a
 * purchase (`?purchase=`, one label per piece received), or items searched
 * here. The label carries the item's barcode, or its code when it has none —
 * either one is what the scanner's lookup matches. Prints on a 50 × 25 mm
 * label roll or an A4 sheet of 65 through the browser's own print.
 */
export function PrintLabelsPageContent(): React.JSX.Element {
  const { t } = useTranslation();
  const params = useSearchParams();
  const business = useAppSelector(selectActiveTenant)?.name ?? '';
  const [rows, setRows] = useState<readonly LabelRow[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [size, setSize] = useState<LabelSize>('roll');
  const [showPrice, setShowPrice] = useState(true);

  const toRow = (item: {
    id: string;
    name: string;
    barcode: string | null;
    sku: string;
    sellingPrice: string;
  }, count: string): LabelRow => ({
    itemId: item.id,
    name: item.name,
    code: item.barcode || item.sku,
    price: item.sellingPrice,
    count,
  });

  useEffect(() => {
    let alive = true;
    const purchaseId = params.get('purchase');
    const itemId = params.get('item');
    if (purchaseId) {
      void getPurchaseBill(purchaseId)
        .then(async ({ bill }) => {
          const lines = bill.lines.filter((line) => line.itemId);
          const items = await Promise.all(lines.map((line) => getItem(line.itemId as string)));
          if (!alive) return;
          setSource(
            t('items.labels.fromPurchase', {
              number: bill.number ?? '',
              count: lines.reduce((sum, line) => sum + Math.round(Number(line.qty)), 0),
            })
          );
          setRows(items.map((item, index) => toRow(item, String(Math.round(Number(lines[index]?.qty ?? 1))))));
        })
        .catch(() => undefined);
    } else if (itemId) {
      void getItem(itemId)
        .then((item) => {
          if (alive) setRows([toRow(item, '1')]);
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once from the address
  }, [params]);

  const total = rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  const labels = useMemo(
    () =>
      rows.flatMap((row) =>
        Array.from({ length: Math.min(Number(row.count) || 0, 500) }, (_, index) => ({
          key: `${row.itemId}-${index}`,
          row,
        }))
      ),
    [rows]
  );

  const setCount = (itemId: string, count: string) =>
    setRows((all) => all.map((row) => (row.itemId === itemId ? { ...row, count } : row)));

  return (
    <UbPageShell>
      <UbBox className="ub-print-hide">
        <UbPageHeader
          title={t('items.labels.title')}
          subtitle={source ?? undefined}
          actions={
            <UbButton
              variant="primary"
              icon={<Printer className="h-4 w-4" aria-hidden />}
              disabled={total === 0}
              onClick={() => window.print()}
              data-testid="labels-print"
            >
              {t('items.labels.print', { count: total })}
            </UbButton>
          }
        />
      </UbBox>
      <UbBox className="ub-print-hide grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <UbStack gap={3}>
          <ItemQuickAdd
            labels={{
              label: t('items.labels.search'),
              placeholder: t('items.labels.search'),
              empty: (query: string) => t('stock.count.pickEmpty', { query }),
              none: t('stock.count.pickNone'),
              askOwner: t('stock.count.pickAskOwner'),
            }}
            onPick={(item) =>
              setRows((all) =>
                all.some((row) => row.itemId === item.id)
                  ? all
                  : [...all, toRow(item, '1')]
              )
            }
            openOnFocus={false}
          />
          {rows.length === 0 ? (
            <UbEmptyState
              variant="firstUse"
              title={t('items.labels.empty.title')}
              description={t('items.labels.empty.body')}
            />
          ) : (
            <UbPanel className="p-0">
              {rows.map((row) => (
                <UbBox
                  key={row.itemId}
                  className="grid grid-cols-[minmax(0,1fr)_auto_80px] items-center gap-3 border-b border-border-hairline px-4 py-2.5 last:border-b-0"
                  data-testid="labels-row"
                >
                  <UbText as="span" variant="body-sm" className="truncate">
                    {row.name}
                  </UbText>
                  <UbText as="span" variant="body-sm" tone="secondary" className="ds-num">
                    {row.code}
                  </UbText>
                  <UbQuantityInput
                    aria-label={t('items.labels.countOf', { name: row.name })}
                    value={row.count}
                    onChange={(value) => setCount(row.itemId, value)}
                    decimals={0}
                    className="h-[34px] w-20 text-right"
                  />
                </UbBox>
              ))}
            </UbPanel>
          )}
        </UbStack>
        <UbPanel className="p-4">
          <UbStack gap={3}>
            <UbText as="p" variant="body-sm-medium">
              {t('items.labels.size')}
            </UbText>
            <UbChoiceChips<LabelSize>
              value={size}
              onChange={setSize}
              options={[
                { value: 'roll', label: t('items.labels.roll') },
                { value: 'sheet', label: t('items.labels.sheet') },
              ]}
              ariaLabel={t('items.labels.size')}
            />
            <UbSwitch
              checked={showPrice}
              onCheckedChange={setShowPrice}
              label={t('items.labels.showPrice')}
              description={
                rows[0] ? t('items.labels.priceHint', { price: formatInr(rows[0].price) }) : undefined
              }
            />
            <UbText as="p" variant="body-sm-medium">
              {t('items.labels.preview')}
            </UbText>
            <UbBox className="grid grid-cols-[repeat(auto-fill,50mm)] gap-2" data-testid="labels-preview">
              {labels.slice(0, 6).map(({ key, row }) => (
                <BarcodeLabel
                  key={key}
                  business={business}
                  name={row.name}
                  code={row.code}
                  price={showPrice ? formatInr(row.price) : null}
                />
              ))}
            </UbBox>
          </UbStack>
        </UbPanel>
      </UbBox>
      {/* What the printer gets: every label, on the chosen paper. */}
      <UbBox className={
          size === 'roll'
            ? 'ub-print-only ub-print-labels-roll hidden'
            : 'ub-print-only ub-print-labels-sheet hidden'
        }>
        {labels.map(({ key, row }) => (
          <BarcodeLabel
            key={key}
            business={business}
            name={row.name}
            code={row.code}
            price={showPrice ? formatInr(row.price) : null}
          />
        ))}
      </UbBox>
    </UbPageShell>
  );
}
