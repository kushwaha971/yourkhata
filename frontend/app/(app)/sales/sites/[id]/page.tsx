'use client';

import { use } from 'react';

import { SiteDetailPageContent } from 'modules/DigiKhaato/features/sales/components/SiteDetailPageContent';

// The words this screen renders arrive with its chunk (src/i18n/catalogueRegistry.ts).
import 'src/i18n/catalogues/sales';

/** G7 — `/sales/sites/<id>`: one site (design pSite). */
export default function SitePage({ params }: Readonly<{ params: Promise<{ id: string }> }>): React.JSX.Element {
  return <SiteDetailPageContent id={use(params).id} />;
}
