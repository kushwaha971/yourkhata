'use client';

import { UbSegmentedControl, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';

import type { AccessLevel, AccessPart } from '../types/accessGroup.types';

// The access words ride with the screens that show them (owner, 14 Nov 2026).
import 'src/i18n/catalogues/teamAccess';

/**
 * One part of the open app and its level (design G2/G4). The name owns its
 * line and the choices sit under it: three choices beside a long name like
 * "Sales (bills, estimates, returns)" do not fit a phone. A member's part that
 * differs from their group is marked, with the group's level beside the name.
 */
export function PartLevelRow({
  part,
  value,
  onChange,
  groupLevel,
  disabled,
}: Readonly<{
  part: AccessPart;
  value: AccessLevel;
  onChange: (level: AccessLevel) => void;
  /** When shown for one member: the group's level, to mark a difference. */
  groupLevel?: AccessLevel;
  disabled?: boolean;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const differs = groupLevel !== undefined && groupLevel !== value;
  const name = t(`team.access.part.${part.part}`);
  return (
    <UbStack
      gap={1.5}
      className={cn('py-2', differs && '-mx-2.5 rounded-control bg-warning-dim px-2.5')}
      data-testid={`part-${part.part}`}
    >
      <UbStack direction="row" gap={2} align="baseline" className="min-w-0 flex-wrap">
        <UbText as="span" variant="inherit" className="text-[14px]">
          {name}
        </UbText>
        {differs && (
          <UbText as="span" variant="caption" className="text-warning">
            {t('team.access.groupSays', { level: t(`team.access.level.${groupLevel}`) })}
          </UbText>
        )}
      </UbStack>
      <UbSegmentedControl<AccessLevel>
        value={value}
        onChange={onChange}
        ariaLabel={name}
        disabled={disabled}
        className={part.levels.length === 2 ? 'max-w-[180px]' : undefined}
        options={part.levels.map((level) => ({ value: level, label: t(`team.access.level.${level}`) }))}
      />
    </UbStack>
  );
}
