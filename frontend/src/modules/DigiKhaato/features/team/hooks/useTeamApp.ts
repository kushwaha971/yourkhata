'use client';

import { useMemo } from 'react';

import { useTranslation } from 'src/hooks/useTranslation';

import { manifestFor } from 'modules/appManifests';

import { PERSONAL_APPS } from '../../navigation/personalApps';
import { useNavigation } from '../../navigation/useNavigation';

/**
 * The app Team is about (owner, 14 Nov 2026): the one that is open. Team in
 * Branch 1 › Business manages Business access there; Library is managed from
 * Library. `null` while no app is open, or in a person's own app (Money book),
 * which nobody else can be given.
 */
export interface TeamApp {
  readonly code: string;
  readonly label: string;
}

export function useTeamApp(): TeamApp | null {
  const { t } = useTranslation();
  const { app } = useNavigation();
  return useMemo(() => {
    if (!app || PERSONAL_APPS.has(app)) return null;
    const labelId = manifestFor(app)?.labelId;
    return { code: app, label: labelId ? t(labelId) : app };
  }, [app, t]);
}
