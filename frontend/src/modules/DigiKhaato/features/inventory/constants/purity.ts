/** A purity as the design prints it in a row: "22K 916". Imports nothing: the
 *  public bill page's print reads it, and must not pay for the tag service. */
export const PURITY_SHORT: Readonly<Record<string, string>> = {
  gold_24k: '24K 999',
  gold_22k: '22K 916',
  gold_18k: '18K 750',
  silver: 'Silver 999',
  silver_925: 'Silver 925',
};

/** One tola is 11.664 g. The design shows tola beside grams. */
export const GRAMS_PER_TOLA = 11.664;
export const toTola = (grams: string | number): string =>
  (Number(grams) / GRAMS_PER_TOLA).toFixed(3);
