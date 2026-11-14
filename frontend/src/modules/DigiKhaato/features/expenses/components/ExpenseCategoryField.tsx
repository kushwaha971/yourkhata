'use client';

import { useCallback, useMemo, useState } from 'react';

import { Plus } from 'lucide-react';

import { UbButton, UbChoiceChips, UbCombobox, UbStack, UbTextInput } from 'src/design-system';
import type { UbFieldRenderProps } from 'src/design-system';
import type { TranslateFn } from 'src/hooks/useTranslation';

import { pickerCategories } from '../view-model/expenseDisplay';

import type { ExpenseCategory } from '../types/expense.types';

/**
 * EXP-02 FR-4 — the category picker, with "New category" beside it.
 *
 * 08 §12.1 — "₹500 tea, cash, today" is three taps: amount, a category CHIP,
 * Save. The six categories the business uses most (the server's usage-first
 * order) are chips; the rest are in the search below them, which appears only
 * when there are more than six. A category picked from the search takes the
 * last chip's place, so the choice is always visible.
 *
 * The picker is the shared `UbCombobox` over the tenant's LIVE categories in
 * the server's usage-first order (the tea a shop buys every morning is at the
 * top). Creating one inline is a second, explicit step rather than a "Create
 * 'xyz'" row inside the combobox, because the combobox does not expose what
 * was typed — and building a second combobox for one feature is the kind of
 * duplicate the design system exists to prevent. Staff at the counter type
 * "Hamali", tap Add, and the new row is selected; a name that already exists
 * comes back as the existing row (EC-1), so a double tap makes one category.
 */
/** How many categories are one tap away. */
const QUICK = 6;

export interface ExpenseCategoryFieldProps {
  readonly field: UbFieldRenderProps;
  readonly categories: readonly ExpenseCategory[];
  readonly canCreate: boolean;
  readonly creating: boolean;
  readonly onCreate: (name: string) => Promise<ExpenseCategory | null>;
  readonly t: TranslateFn;
}

export function ExpenseCategoryField({
  field,
  categories,
  canCreate,
  creating,
  onCreate,
  t,
}: Readonly<ExpenseCategoryFieldProps>): React.JSX.Element {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const options = useMemo(
    () =>
      pickerCategories(categories).map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories]
  );

  const { onChange } = field;
  const handleAdd = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const created = await onCreate(trimmed);
    if (created) {
      onChange(created.id);
      setName('');
      setAdding(false);
    }
  }, [name, onCreate, onChange]);

  const value = field.value as string;
  const quick = useMemo(() => {
    const first = options.slice(0, QUICK);
    const picked = options.find((option) => option.value === value);
    if (!picked || first.some((option) => option.value === value)) return first;
    return [...first.slice(0, QUICK - 1), picked];
  }, [options, value]);

  /* 16 px under the chips: a chip's 44 px target reaches 6 px below it and
     the 28 px "New category" button's reaches 8 px above, so 12 px left them
     overlapping and a tap on the bottom of "Rent" opened New category (found
     by measuring at 390 px). */
  return (
    <UbStack gap={4}>
      <UbChoiceChips<string>
        id={field.id}
        value={value}
        onChange={field.onChange}
        onBlur={field.onBlur}
        options={quick}
        ariaLabel={t('expenses.category.quick')}
        invalid={field.invalid}
        describedBy={field['aria-describedby']}
      />
      {options.length > QUICK && (
        <UbCombobox
          name={field.name}
          value={value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          options={options}
          placeholder={t('expenses.category.more')}
          aria-label={t('expenses.category.more')}
          searchPlaceholder={t('expenses.category.search')}
          emptyLabel={t('expenses.category.none')}
          invalid={field.invalid}
          aria-required={field['aria-required']}
          aria-describedby={field['aria-describedby']}
        />
      )}
      {canCreate &&
        (adding ? (
          <UbStack direction="row" gap={2} align="center">
            <UbTextInput
              value={name}
              onChange={setName}
              aria-label={t('expenses.category.newName')}
              placeholder={t('expenses.category.newName.placeholder')}
              maxLength={40}
              autoComplete="off"
              className="min-w-0 flex-1"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleAdd();
                }
              }}
            />
            <UbButton variant="secondary" onClick={() => void handleAdd()} busy={creating}>
              {t('expenses.category.add')}
            </UbButton>
          </UbStack>
        ) : (
          <UbButton
            variant="ghost"
            size="sm"
            icon={<Plus className="h-4 w-4" aria-hidden />}
            onClick={() => setAdding(true)}
            className="self-start"
          >
            {t('expenses.category.new')}
          </UbButton>
        ))}
    </UbStack>
  );
}
