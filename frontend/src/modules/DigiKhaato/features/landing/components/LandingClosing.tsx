'use client';

// Its words arrive with it, so it renders on the guide pages as on the home page.
import 'src/i18n/catalogues/landing';
import { memo } from 'react';

import { ArrowRight, Facebook, Instagram, Linkedin, Phone } from 'lucide-react';

import {
  UbActionLink,
  UbBox,
  UbDisclosure,
  UbLink,
  UbLogo,
  UbReveal,
  UbStack,
  UbText,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';

import { FACEBOOK_URL, INSTAGRAM_URL, LINKEDIN_URL } from '../config/contact';
import { FAQ_MODULE_SCOPE, faqAnswerKey, faqIds, faqQuestionKey } from '../config/faq';
import { ALL_MODULES_VISIBLE } from '../config/modules';
import { SHOW_PRICING } from '../config/pricing';

import { landingAnchors } from './LandingHeader';
import {
  LANDING_CONTAINER,
  LANDING_SECTION,
  LandingSectionHeading,
  SANS_KEY,
  SERIF_LEAD,
} from './LandingPrimitives';

/**
 * The FAQ. The ids and their order are in `config/faq.ts`, which the server
 * also reads to build the FAQPage JSON-LD, from the same `SHOW_PRICING`. An
 * answer about one module carries `data-module-id`, and the one that names
 * every module `data-module-summary` (the module-vocabulary guard's marks).
 *
 * `keepMounted`: every answer is in the server's HTML, hidden until its
 * question is opened (CR-2026-09-29-PLATFORM-C). A collapsed answer that is
 * not rendered at all is an answer no crawler and no find-in-page can see —
 * and the FAQPage structured data would then describe text the page does not
 * contain, which is what search engines call cloaking.
 */

function FaqSectionBase() {
  const { t } = useTranslation();
  return (
    <UbBox
      as="section"
      id="faq"
      aria-labelledby="landing-faq-title"
      className={`${LANDING_SECTION} scroll-mt-24`}
    >
      <UbBox
        className={`${LANDING_CONTAINER} grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16`}
      >
        <LandingSectionHeading
          id="landing-faq-title"
          eyebrow={t('landing.faq.eyebrow')}
          lead={t('landing.faq.lead')}
          keyLine={t('landing.faq.key')}
          align="start"
          className="lg:sticky lg:top-28 lg:self-start"
        />
        <UbReveal as="ul" stagger className="flex flex-col gap-3">
          {faqIds(SHOW_PRICING).map((id) => (
            <UbBox
              as="li"
              key={id}
              data-module-id={FAQ_MODULE_SCOPE[id] === 'summary' ? undefined : FAQ_MODULE_SCOPE[id]}
              data-module-summary={FAQ_MODULE_SCOPE[id] === 'summary' || undefined}
            >
              <UbDisclosure
                size="lg"
                keepMounted
                label={t(faqQuestionKey(id))}
                className="rounded-[18px] bg-surface-card"
              >
                <UbText variant="inherit" tone="secondary" className="ds-body-base-regular">
                  {t(faqAnswerKey(id, ALL_MODULES_VISIBLE))}
                </UbText>
              </UbDisclosure>
            </UbBox>
          ))}
        </UbReveal>
      </UbBox>
    </UbBox>
  );
}

FaqSectionBase.displayName = 'FaqSection';
export const FaqSection = memo(FaqSectionBase);

/**
 * The closing band: the page's one dark block in BOTH themes (primary-700 →
 * primary-900), so it reads as the end of the page rather than another
 * section. Its type is `--landing-band-text` — white in both themes, which
 * `text-inverse` is not (it turns to ink in dark mode, for the lighter dark
 * accent) — and check-contrast.mjs holds it to 4.5:1 on every stop.
 */
function FinalCtaBase() {
  const { t } = useTranslation();
  return (
    <UbBox as="section" aria-labelledby="landing-cta-title" className="pb-16 md:pb-24">
      <UbBox className={LANDING_CONTAINER}>
        <UbReveal className="relative overflow-clip rounded-[28px] bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 px-6 py-14 text-center md:px-12 md:py-20">
          <UbBox
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-400/30 blur-3xl"
          />
          <UbBox
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-primary-500/30 blur-3xl"
          />
          <UbStack gap={6} align="center" className="relative">
            <UbText
              as="h2"
              id="landing-cta-title"
              variant="inherit"
              tone="inherit"
              className="text-[clamp(2rem,1.3rem+2.6vw,3.25rem)] leading-[1.1] text-[hsl(var(--landing-band-text))]"
            >
              <UbText as="span" variant="inherit" tone="inherit" className={SERIF_LEAD}>
                {t('landing.cta.lead')}
              </UbText>{' '}
              <UbText as="span" variant="inherit" tone="inherit" className={SANS_KEY}>
                {t('landing.cta.key')}
              </UbText>
            </UbText>
            <UbText
              variant="inherit"
              tone="inherit"
              className="max-w-xl text-[1.0625rem] leading-relaxed text-[hsl(var(--landing-band-text))]"
            >
              {t('landing.cta.body')}
            </UbText>
            <UbStack
              direction="row"
              wrap
              gap={3}
              justify="center"
              className="max-sm:w-full max-sm:flex-col"
            >
              <UbActionLink
                href={ROUTES.LOGIN}
                variant="secondary"
                size="lg"
                icon={<ArrowRight aria-hidden className="order-last h-4 w-4" />}
                className="ub-lift h-12 rounded-[14px] bg-[hsl(var(--landing-band-text))] px-6 text-[1.0625rem] text-primary-800 hover:bg-primary-50"
                data-testid="landing-final-start"
              >
                {t('landing.nav.startFree')}
              </UbActionLink>
              <UbActionLink
                href={ROUTES.LOGIN}
                variant="ghost"
                size="lg"
                className="h-12 rounded-[14px] px-6 text-[1.0625rem] text-[hsl(var(--landing-band-text))] ring-1 ring-inset ring-[hsl(var(--landing-band-text)/0.35)] hover:bg-[hsl(var(--landing-band-text)/0.1)]"
              >
                {t('landing.nav.login')}
              </UbActionLink>
            </UbStack>
          </UbStack>
        </UbReveal>
      </UbBox>
    </UbBox>
  );
}

FinalCtaBase.displayName = 'FinalCta';
export const FinalCta = memo(FinalCtaBase);

/** The footer's Solutions group: modules and the business-type index, never a list of every kind. */
const FOOTER_SOLUTIONS: readonly { href: string; key: string; module?: string }[] = [
  { href: '/solutions/shop-billing', key: 'landing.footer.sol.billing' },
  { href: '/solutions/lending-collections', key: 'landing.module.lending.tile', module: 'lending' },
  { href: '/solutions/library-management', key: 'landing.module.library.tile', module: 'library' },
  { href: '/solutions', key: 'landing.footer.sol.byType' },
];

function FooterLink({
  href,
  children,
  module,
}: Readonly<{ href: string; children: string; module?: string }>) {
  return (
    <UbBox as="li" data-module-id={module}>
      <UbLink
        href={href}
        underline={false}
        tone="secondary"
        variant="inherit"
        className="ds-body-base-regular inline-flex items-center hover:text-text-primary hover:underline max-md:min-h-11"
      >
        {children}
      </UbLink>
    </UbBox>
  );
}

function LandingFooterBase({ base = '' }: Readonly<{ base?: string }>) {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <UbBox as="footer" className="border-t border-border-hairline bg-surface-subtle">
      <UbBox
        className={`${LANDING_CONTAINER} grid grid-cols-2 gap-x-8 gap-y-8 py-10 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.8fr)_minmax(0,1.3fr)] md:py-12`}
      >
        <UbStack gap={4} align="start" className="col-span-2 md:col-span-1">
          <UbLogo variant="full" size="md" label="YourKhata" />
          <UbText variant="inherit" tone="tertiary" className="ds-body-base-regular max-w-xs">
            {t('landing.footer.tagline')}
          </UbText>
        </UbStack>
        <UbBox as="nav" aria-label={t('landing.footer.product')}>
          <UbText as="h2" variant="inherit" className="ds-body-s-semibold mb-3">
            {t('landing.footer.product')}
          </UbText>
          <UbStack as="ul" gap={2}>
            {landingAnchors(base)
              .filter((anchor) => !anchor.href.endsWith('#faq'))
              .map((anchor) => (
                <FooterLink key={anchor.href} href={anchor.href}>
                  {t(anchor.key)}
                </FooterLink>
              ))}
          </UbStack>
        </UbBox>
        <UbBox as="nav" aria-label={t('landing.footer.business')} className="col-span-1">
          <UbText as="h2" variant="inherit" className="ds-body-s-semibold mb-3">
            {t('landing.footer.business')}
          </UbText>
          {/* Broad, standard groups (owner, 17 Nov 2026): the list does not grow
              with every business type or feature added later; each group's
              page lists what is inside it. */}
          <UbStack as="ul" gap={2}>
            {FOOTER_SOLUTIONS.map(({ href, key, module }) => (
              <FooterLink key={key} href={href} module={module}>
                {t(key)}
              </FooterLink>
            ))}
          </UbStack>
        </UbBox>
        <UbBox as="nav" aria-label={t('landing.footer.contactSupport')}>
          <UbText as="h2" variant="inherit" className="ds-body-s-semibold mb-3">
            {t('landing.footer.contactSupport')}
          </UbText>
          <UbStack as="ul" gap={2}>
            <UbBox as="li">
              <UbLink
                href="tel:+919794620535"
                tone="secondary"
                underline={false}
                className="inline-flex min-h-8 items-center gap-2 whitespace-nowrap hover:text-text-primary hover:underline"
              >
                <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
                +91-9794620535
              </UbLink>
            </UbBox>
            <FooterLink href={`${base}#faq`}>{t('landing.nav.faq')}</FooterLink>
          </UbStack>
          <UbStack direction="row" align="center" gap={2} className="mt-4" wrap>
            <UbLink
              href={LINKEDIN_URL}
              aria-label="YourKhata on LinkedIn"
              title="LinkedIn"
              underline={false}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-social-linkedin text-white transition-opacity hover:opacity-80 sm:h-8 sm:w-8"
            >
              <Linkedin aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </UbLink>
            <UbLink
              href={FACEBOOK_URL}
              aria-label="YourKhata on Facebook"
              title="Facebook"
              underline={false}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-social-facebook text-white transition-opacity hover:opacity-80 sm:h-8 sm:w-8"
            >
              <Facebook aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </UbLink>
            <UbLink
              href={INSTAGRAM_URL}
              aria-label="YourKhata on Instagram"
              title="Instagram"
              underline={false}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-social-instagram text-white transition-opacity hover:opacity-80 sm:h-8 sm:w-8"
            >
              <Instagram aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </UbLink>
          </UbStack>
        </UbBox>
      </UbBox>
      <UbStack
        className={`${LANDING_CONTAINER} border-t border-border-hairline py-5 md:flex-row md:items-center md:justify-between`}
        gap={5}
      >
        <UbText variant="body-sm" tone="tertiary">
          {t('landing.footer.copyright', { year: String(year) })}
        </UbText>
      </UbStack>
    </UbBox>
  );
}

LandingFooterBase.displayName = 'LandingFooter';
export const LandingFooter = memo(LandingFooterBase);
