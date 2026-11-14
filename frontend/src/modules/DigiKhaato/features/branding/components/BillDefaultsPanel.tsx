'use client';

import { useState } from 'react';

import {
  UbBox,
  UbButton,
  UbPanel,
  UbPanelSection,
  UbStack,
  UbSwitch,
  UbText,
  UbTextArea,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { useSettingsAccess } from 'modules/DigiKhaato/features/settings/hooks/useSettingsAccess';
import { useTenantSettings } from 'modules/DigiKhaato/features/settings/hooks/useTenantSettings';

// The settings hook's messages (saved, conflict) arrive with this panel's chunk.
import 'src/i18n/catalogues/settings';

/** The server's own limit (`DOCUMENT_TERMS_MAX`). */
const TERMS_MAX = 1000;

/**
 * Design settings-and-profile S4 (owner-approved 14 Nov 2026) — "On every
 * bill". Two settings the server already keeps and the bills already read,
 * which no screen could set until now: the terms line printed on an A4 bill
 * (`documents.terms`) and whether a shared bill carries the UPI QR
 * (`documents.show_upi_qr`). The switch saves on the tap; the terms wait for
 * Save, because a sentence is typed, not tapped. Owner and admin change them;
 * the accountant reads them.
 */
export function BillDefaultsPanel(): React.JSX.Element | null {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  const settings = useTenantSettings(access.canView);
  const values = settings.data?.values;
  const savedTerms = ((values?.['documents.terms'] as { text?: string } | undefined)?.text ?? '').trim();
  const showQr = Boolean((values?.['documents.show_upi_qr'] as { value?: boolean } | undefined)?.value ?? true);
  // Untouched, the box shows what is saved; once typed in, the draft.
  const [draft, setDraft] = useState<string | null>(null);
  const terms = draft ?? savedTerms;

  if (!access.canView || !settings.data) return null;
  const locked = !access.canEdit || !settings.canWrite;
  const busy = settings.savingSection === 'documents';

  return (
    <UbPanel as="section">
      <UbPanelSection title={t('branding.bill.title')}>
        <UbStack gap={4}>
          <UbStack gap={2}>
            <UbText as="label" variant="label" htmlFor="bill-terms">
              {t('branding.bill.terms')}
            </UbText>
            <UbTextArea
              id="bill-terms"
              value={terms}
              rows={2}
              maxLength={TERMS_MAX}
              disabled={locked}
              placeholder={t('branding.bill.termsPlaceholder')}
              onChange={setDraft}
            />
            <UbStack direction="row" justify="between" align="center" gap={2}>
              <UbText variant="caption" tone="tertiary">
                {t('branding.bill.termsHint')}
              </UbText>
              {!locked ? (
                <UbButton
                  size="sm"
                  busy={busy}
                  disabled={terms.trim() === savedTerms}
                  onClick={() =>
                    void settings
                      .saveSection('documents', { 'documents.terms': { text: terms } })
                      .then((saved) => saved && setDraft(null))
                  }
                >
                  {t('branding.bill.save')}
                </UbButton>
              ) : null}
            </UbStack>
          </UbStack>
          <UbBox className="border-t border-border-subtle pt-3">
            <UbSwitch
              checked={showQr}
              disabled={locked || busy}
              onCheckedChange={(on) => void settings.saveSection('documents', { 'documents.show_upi_qr': { value: on } })}
              label={t('branding.bill.qr')}
              description={t('branding.bill.qrHint')}
            />
          </UbBox>
        </UbStack>
      </UbPanelSection>
    </UbPanel>
  );
}
