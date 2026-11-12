import { useTranslation } from 'src/hooks/useTranslation';

export type BookScanLabels = {
  close: string;
  torch: string;
  done: string;
  blockedTitle: string;
  blockedBody: string;
  barcode: string;
  add: string;
  keepsWorking: string;
};

/** The camera sheet's words, one place for both scanners on the Books screen. */
export const useBookScanLabels = (): BookScanLabels => {
  const { t } = useTranslation();
  return {
    close: t('library.common.close'),
    torch: t('library.books.scan.torch'),
    done: t('library.common.close'),
    blockedTitle: t('library.books.scan.blockedTitle'),
    blockedBody: t('library.books.scan.blockedBody'),
    barcode: t('library.books.scan.barcode'),
    add: t('library.books.scan.find'),
    keepsWorking: t('library.books.scan.keepsWorking'),
  };
};
