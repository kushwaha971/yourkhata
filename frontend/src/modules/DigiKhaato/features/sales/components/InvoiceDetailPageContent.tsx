'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

import {
  Link2,
  MessageCircle,
  Pencil,
  Printer,
  ReceiptText,
  RotateCcw,
  Wallet,
} from 'lucide-react';

import {
  UbActionLink,
  UbAmount,
  UbButton,
  UbDialog,
  UbDialogLoading,
  UbDrawerLoading,
  UbEmptyState,
  UbInfoRow,
  UbLink,
  UbPageHeader,
  UbPageShell,
  UbPageSkeleton,
  UbPanel,
  UbStack,
  UbStatusBadge,
  UbText,
} from 'src/design-system';
import { useAppSelector } from 'src/hooks/useAppStore';
import { usePermissions } from 'src/hooks/usePermissions';
import { useTranslation } from 'src/hooks/useTranslation';
import { selectLocale } from 'src/redux/slice/localeSlice';
import { selectNetworkImpaired } from 'src/redux/slice/networkSlice';
import { ROUTES } from 'src/routes';
import { formatBusinessDate } from 'src/utils/dates';
import { formatInr } from 'src/utils/money';

import { useInvoiceDetail } from '../hooks/useInvoiceDetail';
import { STATUS_TONE, partyLabel } from '../view-model/invoiceDisplay';

import { DocumentActions } from './DocumentActions';
import { DocumentLinesList } from './DocumentLinesList';
import { DocumentLinksPanel } from './DocumentLinksPanel';
import { OriginBadge } from './OriginBadge';
import { documentCredited } from './print/printModel';

import type { PaymentContext } from '../../payments/types/payment.types';
import type { FlowKind } from '../types/salesFlows.types';

/* The print layouts load with the bill, not with the list or the editor. */
const PrintSheetLazy = dynamic(
  () => import('./print/InvoicePrintSheet').then((m) => m.InvoicePrintSheet),
  { ssr: false, loading: () => <UbPageSkeleton variant="card" /> }
);

/* MSG-02 — the editable share composer arrives only when somebody shares. */
const InvoiceShareSheetLazy = dynamic(
  () => import('./InvoiceShareSheet').then((m) => m.InvoiceShareSheet),
  { ssr: false, loading: () => <UbDialogLoading /> }
);

const InvoiceProfitCardLazy = dynamic(
  () => import('./InvoiceProfitCard').then((m) => m.InvoiceProfitCard),
  { ssr: false }
);

const EwayBillCardLazy = dynamic(() => import('./EwayBillCard').then((m) => m.EwayBillCard), {
  ssr: false,
});

const PaymentFormDrawerLazy = dynamic(
  () => import('../../payments/components/PaymentFormDrawer').then((m) => m.PaymentFormDrawer),
  { ssr: false,
  loading: () => <UbDrawerLoading /> }
);

type DetailKind = 'invoice' | FlowKind;

/** What reading each kind needs (SAL-01 §12: estimates have their own read codename). */
const READ_PERMISSION = {
  invoice: 'sales.invoice.read',
  estimate: 'sales.estimate.read',
  credit_note: 'sales.invoice.read',
  sales_order: 'sales.estimate.read',
  delivery_challan: 'sales.invoice.read',
} as const;

/**
 * SAL-03 — `/sales/invoices/{id}`: the bill as it will print (A4 preview, or
 * the 80 mm slip), with Print A4 / Print 80 mm / Copy link / WhatsApp. The
 * page chrome carries `ub-print-hide`, so paper gets only the sheet. `?print=1`
 * (from the success sheet) opens the print dialog on arrival (SAL-03 US-1).
 *
 * The same page is `/sales/estimates/{id}` and `/sales/credit-notes/{id}`
 * (SAL-01 FR-9, SAL-04 FR-11 reuse the print components): `kind` picks the
 * read, the title on paper and the actions — estimate moves and convert, a
 * bill's return and void, a note's apply and void (`DocumentActions`).
 */
function InvoiceDetailScreen({
  id,
  kind = 'invoice',
}: Readonly<{ id: string; kind?: DetailKind }>): React.JSX.Element {
  const { t } = useTranslation();
  const search = useSearchParams();
  const locale = useAppSelector(selectLocale);
  const { can, hasModule } = usePermissions();
  const detail = useInvoiceDetail(id, search?.get('print') === '1', kind);
  const impaired = useAppSelector(selectNetworkImpaired);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [paymentContext, setPaymentContext] = useState<PaymentContext | null>(null);
  const doc = detail.document?.id === id ? detail.document : null;

  if (!(hasModule('sales') && can(READ_PERMISSION[kind]))) {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="firstUse"
          title={t('sales.noAccess.title')}
          description={t('sales.noAccess.body')}
        />
      </UbPageShell>
    );
  }
  if (detail.status === 'failed') {
    return (
      <UbPageShell>
        <UbEmptyState
          variant="error"
          title={t('sales.detail.error.title')}
          description={detail.error?.message ?? t('sales.detail.error.body')}
        />
      </UbPageShell>
    );
  }
  if (!doc) return <UbPageSkeleton variant="card" />;

  const draft = doc.status === 'draft';
  const invoice = kind === 'invoice';
  const summaryRows: readonly (readonly [string, string])[] = [
    ['sales.totals.grand', doc.grandTotal],
    ...(!draft && invoice
      ? ([
          ['sales.print.paid', doc.amountPaid],
          ...(documentCredited(doc) !== '0.00'
            ? [['sales.print.credited', documentCredited(doc)] as [string, string]]
            : []),
          ['sales.print.balance', doc.amountDue],
        ] as [string, string][])
      : []),
  ];
  return (
    <UbPageShell>
      {paymentContext && (
        <PaymentFormDrawerLazy
          context={paymentContext}
          onClose={() => setPaymentContext(null)}
          onSaved={detail.reload}
        />
      )}
      <UbPageHeader
        className="ub-print-hide"
        title={doc.number ?? t('sales.status.draft')}
        wrapTitle
        subtitle={doc.partySnapshot?.name || partyLabel(doc) || t('sales.walkIn.customer')}
        controls={
          // The controls row is full-width; the badge sizes to its label.
          <UbStack direction="row">
            <UbStatusBadge tone={STATUS_TONE[doc.status]} label={t(`sales.status.${doc.status}`)} />
          </UbStack>
        }
        actions={<DocumentActions doc={doc} menu />}
      />
      <UbStack className="gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_360px]">
        <UbStack className="ub-print-hide min-w-0 gap-4 xl:col-start-2 xl:row-start-1">
          <UbPanel aria-label={t('billDetail.money')}>
            <UbStack as="dl" gap={3} className="p-4">
              {summaryRows.map(([key, value]) => (
                <UbStack
                  key={key}
                  direction="row"
                  gap={3}
                  align="baseline"
                  justify="between"
                  className={
                    key === 'sales.print.balance'
                      ? 'flex-col border-t border-border-hairline pt-3'
                      : ''
                  }
                >
                  <UbText as="dt" id={`summary-${key}`} variant="body-sm" tone="secondary">
                    {t(key)}
                  </UbText>
                  <UbStack as="dd" aria-labelledby={`summary-${key}`}>
                    <UbAmount
                      value={value ?? null}
                      size={key === 'sales.print.balance' ? 'lg' : 'md'}
                    />
                  </UbStack>
                </UbStack>
              ))}
            </UbStack>
            <UbStack gap={2} className="p-4">
              <UbInfoRow
                label={t('sales.editor.date')}
                value={formatBusinessDate(doc.documentDate)}
              />
              {doc.dueOn && (
                <UbInfoRow label={t('sales.editor.dueOn')} value={formatBusinessDate(doc.dueOn)} />
              )}
              {doc.origin && <OriginBadge origin={doc.origin} />}
            </UbStack>
          </UbPanel>
          <UbStack gap={2}>
            <UbStack className="grid grid-cols-2 gap-2">
              {invoice &&
                doc.party &&
                ['issued', 'partially_paid', 'overdue'].includes(doc.status) &&
                hasModule('payments') &&
                can('payments.payment.write') && (
                  <UbButton
                    disabled={impaired}
                    icon={<Wallet className="h-4 w-4" aria-hidden />}
                    className="h-auto min-h-11 whitespace-normal"
                    data-testid="record-payment-action"
                    onClick={() =>
                      setPaymentContext({
                        direction: 'in',
                        bucket: 'shop',
                        tradeRole: 'customer',
                        partyId: doc.party?.id ?? '',
                        partyName: (doc.partySnapshot?.name || doc.party?.name) ?? '',
                        documentId: doc.id,
                        documentNumber: doc.number ?? undefined,
                        documentDue: doc.amountDue,
                        entry: 'invoice',
                      })
                    }
                  >
                    {t('billDetail.receive')}
                  </UbButton>
                )}
              {!draft && doc.status !== 'void' && (
                <UbButton
                  variant="secondary"
                  disabled={impaired}
                  className="h-auto min-h-11 whitespace-normal"
                  icon={<MessageCircle className="h-4 w-4" aria-hidden />}
                  busy={detail.sharing}
                  onClick={() => void detail.share('whatsapp')}
                >
                  {t('billDetail.share')}
                </UbButton>
              )}
              {invoice && draft && can('sales.invoice.write') && (
                <UbActionLink
                  href={`${ROUTES.SALES_INVOICES}/${doc.id}/edit`}
                  variant="primary"
                  icon={<Pencil className="h-4 w-4" aria-hidden />}
                >
                  {t('sales.detail.edit')}
                </UbActionLink>
              )}
            </UbStack>
            {!draft && (
              <>
                <UbStack className="grid grid-cols-2 gap-2">
                  <UbButton
                    variant="secondary"
                    className="h-auto min-h-11 whitespace-normal"
                    icon={<Printer className="h-4 w-4" aria-hidden />}
                    onClick={() => detail.print('a4')}
                    data-testid="print-a4-action"
                  >
                    {t('sales.print.a4')}
                  </UbButton>
                  <UbButton
                    variant="secondary"
                    className="h-auto min-h-11 whitespace-normal"
                    icon={<ReceiptText className="h-4 w-4" aria-hidden />}
                    onClick={() => detail.print('thermal80')}
                    data-testid="print-thermal-action"
                  >
                    {t('sales.print.thermal')}
                  </UbButton>
                </UbStack>
                <UbButton
                  variant="ghost"
                  className="xl:hidden"
                  onClick={() => setPreviewOpen(true)}
                >
                  {t('billDetail.seePrinted')}
                </UbButton>
              </>
            )}
          </UbStack>
          <DocumentLinksPanel doc={doc} />
          {doc.payments.length > 0 && (
            <UbPanel aria-label={t('billDetail.payments')}>
              <UbText className="p-4 font-semibold" variant="body-sm">
                {t('billDetail.payments')}
              </UbText>
              {doc.payments.map((row) => (
                <UbStack key={row.id} gap={1} className="p-4" data-testid="invoice-payments">
                  <UbLink href={`${ROUTES.PAYMENTS}/${row.id}`}>{row.number}</UbLink>
                  <UbText variant="caption" tone="secondary">
                    {formatBusinessDate(row.paymentDate)} · {formatInr(row.amount)}
                    {row.status === 'void' ? ` · ${t('payments.status.void')}` : ''}
                  </UbText>
                </UbStack>
              ))}
            </UbPanel>
          )}
          {detail.shareLink && (
            <UbStack gap={2}>
              <UbText variant="caption" tone="secondary">
                {t('sales.share.validUntil', {
                  date: formatBusinessDate(detail.shareLink.expiresAt.slice(0, 10)),
                })}
              </UbText>
              <UbButton
                variant="secondary"
                disabled={impaired}
                icon={<Link2 className="h-4 w-4" aria-hidden />}
                onClick={() => void detail.share('link')}
              >
                {t('sales.share.copyLink')}
              </UbButton>
              {can('sales.invoice.void') && (
                <UbButton
                  variant="ghost"
                  disabled={impaired}
                  icon={<RotateCcw className="h-4 w-4" aria-hidden />}
                  busy={detail.sharing}
                  onClick={() => void detail.resetLink()}
                >
                  {t('sales.share.reset')}
                </UbButton>
              )}
            </UbStack>
          )}
          {invoice && !draft && doc.status !== 'void' && can('reports.financial.read') && (
            <InvoiceProfitCardLazy id={doc.id} />
          )}
          {/* D P5 — design D10: the e-way bill file, offered by the server. */}
          {invoice && !draft && doc.status !== 'void' && can('sales.invoice.write') && (
            <EwayBillCardLazy id={doc.id} number={doc.number} />
          )}
        </UbStack>
        <DocumentLinesList doc={doc} />
        <UbStack
          className="hidden min-w-0 overflow-x-auto rounded-card border border-border-hairline bg-white xl:col-start-1 xl:row-start-1 xl:flex print:flex print:overflow-visible print:rounded-none print:border-0"
          data-testid="desktop-paper-preview"
        >
          <PrintSheetLazy
            doc={doc}
            upi={detail.upi}
            branding={detail.branding}
            locale={locale}
            template={detail.template}
          />
        </UbStack>
      </UbStack>
      {previewOpen && (
        <UbDialog
          open
          onOpenChange={setPreviewOpen}
          title={t('sales.print.preview')}
          closeLabel={t('common.action.close')}
          className="sm:w-[calc(100vw-2rem)] sm:max-w-4xl"
        >
          <UbStack
            className="overflow-x-auto bg-white"
            role="region"
            aria-label={t('sales.print.preview')}
            tabIndex={0}
          >
            <PrintSheetLazy
              doc={doc}
              upi={detail.upi}
              branding={detail.branding}
              locale={locale}
              template={detail.template}
            />
          </UbStack>
        </UbDialog>
      )}

      {detail.composer && (
        <InvoiceShareSheetLazy
          title={t('sales.share.whatsapp')}
          party={partyLabel(doc) ?? t('sales.walkIn.customer')}
          message={detail.composer.message}
          phone={detail.composer.phone}
          onClose={detail.closeComposer}
        />
      )}
    </UbPageShell>
  );
}

import 'src/i18n/catalogues/salesDetail';

/** A different document must never retain the previous payment/share/print state. */
export function InvoiceDetailPageContent({
  id,
  kind = 'invoice',
}: Readonly<{ id: string; kind?: DetailKind }>): React.JSX.Element {
  return <InvoiceDetailScreen key={`${kind}:${id}`} id={id} kind={kind} />;
}
