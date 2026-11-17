'use client';

import { memo } from 'react';

import {
  ArrowRight,
  BellRing,
  BookOpen,
  CakeSlice,
  Car,
  ChartColumn,
  Gem,
  Hammer,
  HandCoins,
  Library,
  NotebookPen,
  Package,
  Pill,
  ReceiptIndianRupee,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sprout,
  Truck,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

import { UbBox, UbLink, UbReveal, UbStack, UbText } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

import { LANDING_CONTAINER, LANDING_SECTION, LandingSectionHeading } from './LandingPrimitives';

/**
 * "Choose your business" (owner, 17 Nov 2026): the home page's one job after
 * the hero is to send each visitor to the page written for them. Every tile is
 * a plain link to that business's guide page (`config/shopKinds.ts`,
 * `config/solutions.ts`), which is also what gives those pages their internal
 * links for search. The kinds are the sign-up screen's (R-DEC-63).
 */
/** A business's tile label: a module's own key for Lending and Library. */
export const businessLabelKey = (id: string, module?: string): string =>
  module ? `landing.module.${module}.tile` : `landing.biz.${id}`;

export const BUSINESSES: readonly {
  readonly id: string;
  readonly slug: string;
  readonly icon: LucideIcon;
  /** Lending and Library speak their own words only inside their own elements (moduleVocabulary). */
  readonly module?: 'lending' | 'library';
}[] = [
  { id: 'kirana', slug: 'shop-kirana', icon: ShoppingBasket },
  { id: 'electronics', slug: 'shop-electronics', icon: Smartphone },
  { id: 'jewellery', slug: 'shop-jewellery', icon: Gem },
  { id: 'hardware', slug: 'shop-hardware', icon: Hammer },
  { id: 'wholesale', slug: 'shop-wholesale', icon: Warehouse },
  { id: 'medical', slug: 'shop-medical', icon: Pill },
  { id: 'garments', slug: 'shop-garments', icon: Shirt },
  { id: 'autoParts', slug: 'shop-auto-parts', icon: Car },
  { id: 'stationery', slug: 'shop-stationery', icon: BookOpen },
  { id: 'agri', slug: 'shop-agri', icon: Sprout },
  { id: 'furniture', slug: 'shop-furniture', icon: Sofa },
  { id: 'food', slug: 'shop-food', icon: CakeSlice },
  { id: 'lending', slug: 'lending-collections', icon: HandCoins, module: 'lending' },
  { id: 'library', slug: 'library-management', icon: Library, module: 'library' },
];

/** `bare`: inside a page that already has its title and width (the guides hub). */
function BusinessSectionBase({ bare = false }: Readonly<{ bare?: boolean }>) {
  const { t } = useTranslation();
  return (
    <UbBox
      as="section"
      id="business"
      aria-labelledby={bare ? undefined : 'landing-business-title'}
      aria-label={bare ? t('landing.biz.eyebrow') : undefined}
      className={bare ? 'scroll-mt-24' : `${LANDING_SECTION} scroll-mt-24`}
    >
      <UbBox className={bare ? undefined : LANDING_CONTAINER}>
        {bare ? null : (
          <LandingSectionHeading
            id="landing-business-title"
            eyebrow={t('landing.biz.eyebrow')}
            lead={t('landing.biz.lead')}
            keyLine={t('landing.biz.key')}
          />
        )}
        <UbReveal
          as="ul"
          stagger
          className={`${bare ? '' : 'mt-10'}grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7`}
        >
          {BUSINESSES.map(({ id, slug, icon: Icon, module }) => (
            <UbBox as="li" key={id} data-module-id={module}>
              <UbLink
                href={`/solutions/${slug}`}
                underline={false}
                tone="inherit"
                data-business={id}
                className="group flex h-full min-h-16 items-center gap-3 rounded-[18px] border border-border-hairline bg-surface-card p-3 text-text-primary outline-none transition-[border-color,box-shadow,transform] duration-base ease-standard hover:-translate-y-0.5 hover:border-accent-line hover:shadow-[0_20px_44px_-30px_var(--device-glow)] focus-visible:shadow-focus sm:min-h-[104px] sm:flex-col sm:items-start sm:justify-between sm:p-4"
              >
                <UbBox
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-quiet text-text-accent"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </UbBox>
                <UbText as="span" variant="inherit" className="ds-body-base-semibold text-balance">
                  {t(businessLabelKey(id, module))}
                </UbText>
              </UbLink>
            </UbBox>
          ))}
        </UbReveal>
        <UbText variant="inherit" tone="tertiary" align="center" className="ds-body-s-regular mt-5">
          {t('landing.biz.note')}
        </UbText>
      </UbBox>
    </UbBox>
  );
}

BusinessSectionBase.displayName = 'BusinessSection';
export const BusinessSection = memo(BusinessSectionBase);

/** The six everyday jobs, as cards. Their how-to lives in each business's guides. */
const JOBS: readonly { readonly id: string; readonly icon: LucideIcon }[] = [
  { id: 'bill', icon: ReceiptIndianRupee },
  { id: 'dues', icon: NotebookPen },
  { id: 'remind', icon: BellRing },
  { id: 'stock', icon: Package },
  { id: 'purchase', icon: Truck },
  { id: 'reports', icon: ChartColumn },
];

/** The business pages people search for most, in that order. */
const POPULAR = ['kirana', 'medical', 'electronics', 'wholesale', 'jewellery', 'hardware'] as const;

function JobsSectionBase() {
  const { t } = useTranslation();
  return (
    <UbBox
      as="section"
      id="features"
      aria-labelledby="landing-jobs-title"
      className={`${LANDING_SECTION} scroll-mt-24 bg-surface-subtle`}
    >
      <UbBox className={LANDING_CONTAINER}>
        <LandingSectionHeading
          id="landing-jobs-title"
          eyebrow={t('landing.jobs.eyebrow')}
          lead={t('landing.jobs.lead')}
          keyLine={t('landing.jobs.key')}
        />
        <UbReveal
          as="ul"
          stagger
          className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:mt-10 lg:grid-cols-3"
        >
          {JOBS.map(({ id, icon: Icon }) => (
            <UbBox
              as="li"
              key={id}
              className="rounded-[20px] border border-border-hairline bg-surface-card p-4 sm:p-5"
            >
              {/* Two to a row on a phone, icon above the words (17 Nov 2026: less scrolling). */}
              <UbBox className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <UbBox
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-action text-text-inverse"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </UbBox>
                <UbStack gap={1}>
                  <UbText as="h3" variant="inherit" className="ds-body-l-semibold">
                    {t(`landing.jobs.${id}.title`)}
                  </UbText>
                  <UbText
                    variant="inherit"
                    tone="secondary"
                    className="ds-body-s-regular sm:ds-body-base-regular"
                  >
                    {t(`landing.jobs.${id}.body`)}
                  </UbText>
                </UbStack>
              </UbBox>
            </UbBox>
          ))}
        </UbReveal>
        {/* The most-searched business pages, linked from the home page for search
            (17 Nov 2026 review) without bringing the tile grid back. */}
        <UbStack
          as="nav"
          aria-label={t('landing.jobs.popular')}
          direction="row"
          wrap
          justify="center"
          align="center"
          className="mt-8 gap-x-1 gap-y-1"
        >
          <UbText as="span" variant="inherit" tone="tertiary" className="ds-body-s-medium mr-1">
            {t('landing.jobs.popular')}
          </UbText>
          {POPULAR.map((id) => {
            const entry = BUSINESSES.find((b) => b.id === id);
            return entry ? (
              <UbLink
                key={id}
                href={`/solutions/${entry.slug}`}
                underline={false}
                className="ds-body-s-medium inline-flex min-h-11 items-center rounded-pill px-3 text-text-accent hover:bg-accent-quiet"
              >
                {t(businessLabelKey(id))}
              </UbLink>
            ) : null;
          })}
        </UbStack>
        <UbStack align="center" className="mt-2">
          <UbLink
            href="/solutions"
            underline={false}
            className="ds-body-base-semibold inline-flex min-h-11 items-center gap-2 text-text-accent hover:underline"
          >
            {t('landing.jobs.cta')}
            <ArrowRight aria-hidden className="h-4 w-4" />
          </UbLink>
        </UbStack>
      </UbBox>
    </UbBox>
  );
}

JobsSectionBase.displayName = 'JobsSection';
export const JobsSection = memo(JobsSectionBase);
