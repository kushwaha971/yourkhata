import type { TranslateFn } from 'src/hooks/useTranslation';
/** "GST usually": GST5 reads 5%, the zero-rate kinds keep their own words. */
export const usualGstLabel = (code: string | null | undefined, t: TranslateFn): string => {
  if (!code) return '—';
  const rate = /^GST(\d+(?:\.\d+)?)$/.exec(code);
  if (rate) return `${rate[1]}%`;
  return ['EXEMPT', 'NIL', 'NONGST'].includes(code) ? t(`tax.rate.${code}`) : code;
};
