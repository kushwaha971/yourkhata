/**
 * A discount as the sales and purchase APIs take it: a type and a value, or
 * neither.
 *
 * No number is no discount. A type sent without a value is a pair both servers
 * refuse ("Enter a discount."), and it failed EVERY save of the document: a
 * merchant who typed a discount and deleted it got "Please check the
 * highlighted fields" on each autosave while the field showed "No discount"
 * and nothing was highlighted (found by seeded monkey testing, A3; FB-014).
 * One owner for both editors, so the rule cannot drift between them.
 */
const NUMBER = /^\d+(\.\d+)?$/;

export interface DiscountWire {
  readonly discount_type: string | null;
  readonly discount_value: string | null;
}

export const discountWire = (
  type: string | null | undefined,
  value: string | null | undefined
): DiscountWire =>
  type && value != null && NUMBER.test(value.trim())
    ? { discount_type: type, discount_value: value }
    : { discount_type: null, discount_value: null };
