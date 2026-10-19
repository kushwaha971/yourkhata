'use client';

import { useShareSheetLabels } from 'src/hooks/useShareSheetLabels';
import { useTranslation } from 'src/hooks/useTranslation';
import { formatPhoneForDisplay } from 'src/utils/share';

import { PartyReminderSheet } from 'modules/DigiKhaato/features/reminders/components/PartyReminderSheet';

import type { Party } from '../types/party.types';

/** Loads the existing editable, logged reminder flow only when it opens. */
export function ShopCustomerReminder({
  party,
  onClose,
}: Readonly<{
  party: Pick<Party, 'id' | 'name' | 'mobile'>;
  onClose: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const labels = useShareSheetLabels(true);
  return (
    <PartyReminderSheet
      partyId={party.id}
      book="shop"
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('parties.list.shop.remindTitle', { name: party.name })}
      description={`${party.name}${party.mobile ? ` · ${formatPhoneForDisplay(party.mobile)}` : ''}`}
      phone={party.mobile}
      labels={labels}
    />
  );
}

// This drawer can open from Home as well as the party register.
import 'src/i18n/catalogues/parties';
