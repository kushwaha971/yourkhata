import { parseAmountInput, compareMoney, toMoneyString } from 'src/utils/money';

/** A trailing amount is an intent, never a posted transaction or a phone number. */
export function counterIntent(query: string): { term: string; amount: string | null } {
  const text = query.trim();
  const match = text.match(/^(?:(.*?)\s+)?₹?([\d,]+(?:\.\d{1,2})?)$/u);
  if (!match) return { term: text, amount: null };
  const term = (match[1] ?? '').trim();
  // Plain 10-digit input is a mobile lookup; ₹ makes an explicit amount.
  if (!term && !text.includes('₹') && /^\d{10,}$/.test(match[2] ?? ''))
    return { term: text, amount: null };
  const amount = parseAmountInput(match[2] ?? '');
  return amount && compareMoney(amount, '0') > 0
    ? { term, amount: toMoneyString(amount) }
    : { term: text, amount: null };
}
