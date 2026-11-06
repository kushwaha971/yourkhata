'use client';
import { UbPanel, UbStack, UbBox, UbText, UbLink, UbButton } from 'src/design-system';
import { UbBalanceBands } from 'src/design-system/charts/UbBalanceBands/UbBalanceBands';
import { useTranslation } from 'src/hooks/useTranslation';
import { partyPath } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { useAppWords } from '../../navigation/useAppWords';

import type { CounterLane } from '../api/counterService';
export interface HomeLanePerson {
  id: string;
  name: string;
  balance: string;
  mobile?: string | null;
  mobileMasked?: string;
  daysLate?: number;
  dueOn?: string | null;
}
export function HomeBalanceLane({
  supplier,
  amount,
  href,
  details,
  people,
  canAct,
  onAct,
  children,
  failure,
  promises,
}: Readonly<{
  supplier: boolean;
  amount: string | null;
  href: string;
  details?: CounterLane;
  people: readonly HomeLanePerson[];
  canAct: boolean;
  onAct: (person: HomeLanePerson) => void;
  children?: React.ReactNode;
  failure?: React.ReactNode;
  /** BP-16 — "promised ₹1,500 today", by contact id, for the caption. */
  promises?: ReadonlyMap<string, string>;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const { w } = useAppWords();
  const displayAmount = details?.total ?? amount;
  const label = w(supplier ? 'reports.home.toPay' : 'reports.home.toCollect');
  const rows: readonly HomeLanePerson[] = details
    ? details.people.map((p) => ({
        id: p.id,
        name: p.name,
        balance: p.amount,
        mobile: p.mobile,
        mobileMasked: p.mobile_masked ?? undefined,
        daysLate: p.days_late,
        dueOn: p.due_on,
      }))
    : people.slice(0, 3);
  return (
    <UbPanel
      as="section"
      aria-label={t(
        supplier ? 'reports.dashboard.suppliers.title' : 'reports.dashboard.customers.title'
      )}
      className="bg-surface-card [&>.h-px]:hidden lg:[&>.h-px]:block"
    >
      {/* The design's head: "To collect · customers" and the amount on one line. */}
      <UbStack direction="row" justify="between" align="center" className="gap-2 px-4 py-3">
        <UbText as="h2" variant="inherit" className="min-w-0 text-[15px] font-semibold">
          {label}
        </UbText>
        <UbLink
          href={href}
          aria-label={`${t(supplier ? 'reports.dashboard.tile.toPay' : 'reports.dashboard.tile.toCollect')} ${formatInr(displayAmount)}`}
          underline={false}
          className={`ds-num shrink-0 font-bold text-body-sm ${supplier ? 'text-give' : 'text-get'}`}
        >
          {displayAmount === null ? null : formatInr(displayAmount)}
        </UbLink>
      </UbStack>
      {failure && <UbBox className="p-3">{failure}</UbBox>}
      <UbStack
        as="ul"
        aria-label={t(
          supplier ? 'reports.dashboard.suppliers.title' : 'reports.dashboard.customers.title'
        )}
        gap={0}
        className="hidden lg:flex"
      >
        {rows.map((person) => (
          <UbStack
            key={person.id}
            as="li"
            direction="row"
            align="center"
            className="flex-wrap gap-3 border-b border-border-hairline p-4 last:border-b-0"
          >
            <UbStack gap={1} className="min-w-0 flex-1 basis-32">
              <UbLink
                href={partyPath(person.id, supplier ? 'supplier' : undefined)}
                underline={false}
                variant="body-sm-medium"
                className="whitespace-normal break-words"
              >
                {person.name}
              </UbLink>
              {(person.daysLate !== undefined || promises?.has(person.id)) && (
                <UbText variant="caption" tone="secondary" className="ds-num">
                  {[
                    person.daysLate === undefined
                      ? ''
                      : person.daysLate > 0
                        ? t('reports.home.daysLate', { count: person.daysLate })
                        : person.dueOn
                          ? t('reports.home.dueOn', { date: formatBusinessDate(person.dueOn) })
                          : t('reports.home.notDue'),
                    promises?.get(person.id) ?? '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </UbText>
              )}
            </UbStack>
            <UbStack direction="row" align="center" className="flex-wrap gap-2">
              <UbText variant="body-sm-medium" className="ds-num">
                {formatInr(person.balance)}
              </UbText>
              {canAct && (supplier || person.mobile) && (
                <UbButton
                  variant="outlineNeutral"
                  size="sm"
                  onClick={() => onAct(person)}
                  aria-label={
                    supplier
                      ? t('reports.home.pay')
                      : t('reports.dashboard.debtors.remind', { name: person.name })
                  }
                >
                  {t(supplier ? 'reports.home.pay' : 'reports.home.remind')}
                </UbButton>
              )}
            </UbStack>
          </UbStack>
        ))}
        {!failure && !rows.length && (
          <UbText variant="caption" tone="secondary" className="p-4">
            {t(supplier ? 'reports.dashboard.suppliers.none' : 'reports.dashboard.customers.none')}
          </UbText>
        )}
      </UbStack>
      <UbStack gap={2} className={details?.count ? 'hidden p-4 lg:flex' : 'hidden'}>
        {details && (
          <UbText variant="caption" tone="secondary">
            {t(supplier ? 'reports.home.supplierCount' : 'reports.home.customerCount', {
              count: details.count,
            })}
          </UbText>
        )}
        {details && (
          <UbBox className="hidden lg:block">
            <UbBalanceBands
              label={label}
              bands={details.bands.map((b) => ({
                key: b.key,
                label: t(`reports.home.band.${b.key}`),
                value: formatInr(b.amount),
                amount: b.amount,
              }))}
            />
            <UbText variant="caption" tone="secondary" className="mt-1">
              {t('reports.home.bandBasis')}
            </UbText>
          </UbBox>
        )}
      </UbStack>
      {children && <UbBox className="hidden px-4 lg:block">{children}</UbBox>}
      <UbBox className="hidden p-4 lg:block">
        <UbLink href={href} variant="caption">
          {t(
            supplier ? 'reports.dashboard.suppliers.viewAll' : 'reports.dashboard.customers.viewAll'
          )}
        </UbLink>
      </UbBox>
    </UbPanel>
  );
}
