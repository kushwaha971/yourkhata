/**
 * The blur handler for a field a drawer FOCUSES when it opens (its name).
 *
 * With `mode: 'onTouched'`, leaving that empty box for any other control (a
 * switch, a chip) marked it touched and painted "Enter the item name." in red
 * before the merchant had tried to save anything (A5 manual pass, 27 Oct 2026;
 * the same class as LED-01's "drawer opened in a red state"). An empty value
 * the merchant never typed is not checked on the way out; it is checked on
 * Save, and anything typed is still checked as they leave.
 */
export const blurIfTyped =
  (field: { readonly value: unknown; readonly onBlur: () => void }, submitted: boolean) =>
  (): void => {
    if (submitted || (typeof field.value === 'string' ? field.value.trim() !== '' : field.value != null))
      field.onBlur();
  };
