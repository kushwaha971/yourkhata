'use client';

import { useEffect, useState } from 'react';

import { Printer } from 'lucide-react';
import { createPortal } from 'react-dom';


import { UbBox, UbButton, UbDialog, UbQrCode, UbStack, UbStatusBanner, UbText } from 'src/design-system';
import { useAppRouter } from 'src/hooks/useAppRouter';
import { useTranslation, type TranslateFn } from 'src/hooks/useTranslation';

import { getPoster, type Poster } from '../api/libraryService';
import { useLibraryAccess } from '../hooks/useLibraryAccess';
import { LIBRARY_ROUTES } from '../routes';
import { rupees } from '../view-model/libraryDisplay';

/** The poster itself: the library's name, each shift's fee, the UPI QR. */
function PosterSheet({ poster, t }: Readonly<{ poster: Poster; t: TranslateFn }>) {
  return (
    <UbStack gap={4} align="center" className="py-2 text-center" data-testid="library-poster">
      <UbText variant="inherit" className="text-[22px] font-extrabold">
        {poster.name}
      </UbText>
      <UbText variant="inherit" className="text-[14px] text-text-secondary">
        {t('library.poster.monthlyFees')}
      </UbText>
      <UbStack gap={1} className="w-full max-w-[280px]">
        {poster.shifts.map((s) => (
          <UbStack key={s.name} direction="row" justify="between" className="border-b border-border-hairline py-1.5 text-[15px]">
            <UbText variant="inherit">{s.name}</UbText>
            <UbText variant="inherit" className="ds-num font-bold">
              {Number(s.monthlyFee) > 0 ? rupees(s.monthlyFee) : '—'}
            </UbText>
          </UbStack>
        ))}
      </UbStack>
      {poster.qr && (
        <UbStack gap={1} align="center">
          <UbQrCode modules={poster.qr} size="44mm" label={t('library.poster.qr', { upi: poster.upiId })} />
          <UbText variant="inherit" className="ds-num text-[14px] font-semibold">
            {poster.upiId}
          </UbText>
          <UbText variant="inherit" className="text-[12.5px] text-text-tertiary">
            {t('library.poster.scan')}
          </UbText>
        </UbStack>
      )}
    </UbStack>
  );
}

/**
 * I7 · Fee poster with QR — for the wall. A QR is drawn only when a UPI ID is
 * set; without one the dialog says so and links to Settings rather than
 * printing a poster with nothing to pay to.
 */
export function FeePoster({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation();
  const router = useAppRouter();
  const { canManage } = useLibraryAccess();
  const [poster, setPoster] = useState<Poster | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getPoster(controller.signal).then(setPoster).catch(() => undefined);
    return () => controller.abort();
  }, []);

  // The poster is the only thing on paper while it prints (the A4b print rule in globals.css).
  useEffect(() => {
    if (!printing) return undefined;
    document.body.setAttribute('data-printing-slip', '');
    const timer = window.setTimeout(() => {
      window.print();
      document.body.removeAttribute('data-printing-slip');
      setPrinting(false);
    }, 50);
    return () => {
      window.clearTimeout(timer);
      document.body.removeAttribute('data-printing-slip');
    };
  }, [printing]);

  return (
    <UbDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={t('library.fees.poster')}
      closeLabel={t('library.common.close')}
      footer={
        <UbButton icon={<Printer className="h-4 w-4" aria-hidden />} disabled={!poster} onClick={() => setPrinting(true)}>
          {t('library.poster.print')}
        </UbButton>
      }
    >
      {poster ? (
        <UbStack gap={3}>
          {!poster.qr && (
            <UbStatusBanner
              tone="info"
              title={t('library.poster.noUpi')}
              action={
                canManage ? (
                  <UbButton variant="outlineNeutral" size="sm" onClick={() => router.push(LIBRARY_ROUTES.settings)}>
                    {t('library.poster.addUpi')}
                  </UbButton>
                ) : undefined
              }
            />
          )}
          <PosterSheet poster={poster} t={t} />
        </UbStack>
      ) : (
        <UbText variant="inherit" className="text-[13px] text-text-tertiary">
          {t('library.common.loading')}
        </UbText>
      )}
      {printing &&
        poster &&
        createPortal(
          <UbBox className="ub-print-only ub-print-slip hidden">
            <PosterSheet poster={poster} t={t} />
          </UbBox>,
          document.body
        )}
    </UbDialog>
  );
}
