'use client';

import { memo } from 'react';

import { UbBox, UbSwitch } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { WEEKDAYS, lastOpenDay, toggleWeekday } from '../view-model/calendarDisplay';

import type { Weekday } from '../types/calendar.types';

/**
 * Design settings-and-profile S5 (owner-approved 14 Nov 2026) — one row per
 * day, Monday to Sunday, with a switch that is ON while the business is open
 * that day and a word saying which. The value is still the CLOSED days, as the
 * server stores it. The last open day's switch is locked (BR-2: at least one
 * day stays open). No opening hours are shown: the business has none stored.
 */
function WeekdaySwitchesInner({
  value,
  disabled,
  onChange,
}: Readonly<{
  value: readonly Weekday[];
  disabled: boolean;
  onChange: (next: Weekday[]) => void;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const lastOpen = lastOpenDay(value);
  return (
    <UbBox as="ul" className="divide-y divide-border-subtle">
      {WEEKDAYS.map((day) => {
        const open = !value.includes(day);
        return (
          <UbBox as="li" key={day} className="py-2">
            <UbSwitch
              checked={open}
              onCheckedChange={() => onChange(toggleWeekday(value, day))}
              label={t(`calendar.weekdayLong.${day}`)}
              description={t(open ? 'calendar.day.open' : 'calendar.day.closed')}
              disabled={disabled || day === lastOpen}
            />
          </UbBox>
        );
      })}
    </UbBox>
  );
}

export const WeekdaySwitches = memo(WeekdaySwitchesInner);
