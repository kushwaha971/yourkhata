import { formattingLocale } from 'src/i18n/formattingLocale';

/*
 * Its own module rather than `dates.ts`: every editor imports `dates.ts`, and
 * the locale mapping it would drag in cost each of them 0.4 KB they never use.
 */
/**
 * "Sat" / "शनि" for a wire date, in the screen's language. `locale` is the
 * screen's (`hi-IN`), which `formattingLocale` maps; formatting with `hi` only
 * when it was exactly "hi" printed "Sat" on a Hindi screen.
 */
export const weekdayShort = (iso: string, locale: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(formattingLocale(locale), {
    weekday: 'short',
    timeZone: 'UTC',
  });
