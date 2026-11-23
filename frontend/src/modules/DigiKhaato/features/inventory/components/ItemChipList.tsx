'use client';

import { useState } from 'react';

import { Plus, X } from 'lucide-react';

import { UbBox, UbButton, UbStack, UbText, UbTextInput } from 'src/design-system';

/**
 * D P1b / P2 — a row of teal chips with a ⊕ that turns into a short box
 * (design D3: "Other part numbers", "Sizes", "Colours"). Enter or leaving the
 * box adds; a repeat (any case) is ignored; × removes.
 */
export function ItemChipList({
  values,
  onChange,
  label,
  addLabel,
  removeLabel,
  placeholder,
  max,
  maxLength = 40,
  upper = false,
  testId,
}: Readonly<{
  values: readonly string[];
  onChange: (next: string[]) => void;
  label: string;
  addLabel: string;
  removeLabel: (value: string) => string;
  placeholder: string;
  max: number;
  maxLength?: number;
  upper?: boolean;
  testId: string;
}>): React.JSX.Element {
  const [typing, setTyping] = useState<string | null>(null);
  const add = (): void => {
    const raw = (typing ?? '').trim();
    const value = upper ? raw.toUpperCase() : raw;
    setTyping(null);
    if (!value || values.length >= max) return;
    if (values.some((one) => one.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
  };
  return (
    <UbStack gap={1.5}>
      <UbText as="p" variant="body-sm-medium">
        {label}
      </UbText>
      <UbStack direction="row" gap={2} className="flex-wrap" align="center">
        {values.map((value) => (
          <UbBox
            key={value}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-accent-line bg-accent-quiet pl-3 pr-1 text-text-accent"
          >
            <UbText as="span" variant="body-sm">
              {value}
            </UbText>
            <UbButton
              variant="ghost"
              size="sm"
              iconOnly
              icon={<X className="h-3.5 w-3.5" aria-hidden />}
              onClick={() => onChange(values.filter((one) => one !== value))}
              aria-label={removeLabel(value)}
            >
              {removeLabel(value)}
            </UbButton>
          </UbBox>
        ))}
        {typing === null ? (
          values.length < max && (
            <UbButton
              variant="outlineNeutral"
              size="sm"
              icon={<Plus className="h-4 w-4" aria-hidden />}
              onClick={() => setTyping('')}
              data-testid={`${testId}-add`}
            >
              {addLabel}
            </UbButton>
          )
        ) : (
          <UbTextInput
            autoFocus
            value={typing}
            onChange={setTyping}
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
              if (event.key === 'Escape') setTyping(null);
            }}
            onBlur={add}
            maxLength={maxLength}
            aria-label={label}
            placeholder={placeholder}
            className="h-8 w-40"
            data-testid={`${testId}-input`}
          />
        )}
      </UbStack>
    </UbStack>
  );
}
