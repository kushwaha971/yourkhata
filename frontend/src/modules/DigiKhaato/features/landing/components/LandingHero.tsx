'use client';

import { memo } from 'react';

import { BookOpenCheck, CircleCheck } from 'lucide-react';

import {
  UbActionLink,
  UbBox,
  UbDeviceFrame,
  UbRotatingText,
  UbStack,
  UbText,
  UbVideo,
} from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { ROUTES } from 'src/routes';

import { DESKTOP_MEDIA, HERO_DESKTOP, HERO_MOBILE, MOBILE_MEDIA } from '../config/media';

import { LANDING_CONTAINER, SANS_KEY, SERIF_LEAD } from './LandingPrimitives';

const WORD_MARK = '⁣WORD⁣';

/** "Track {word}" → ["Track ", ""]; "हिसाब रखें: {word}" → ["हिसाब रखें: ", ""]. */
export const splitAroundWord = (message: string): readonly [string, string] => {
  const [before = '', after = ''] = message.split(WORD_MARK);
  return [before, after];
};

/**
 * The rotating word names what businesses across the modules keep track of
 * (CR-2026-09-29-PLATFORM-D): a shop's dues, bills and stock, and the fees and
 * collections other modules keep. Only words that belong to no single module —
 * "fees" is a gym's and a library's alike — so the hero
 * never speaks for one module outside its own card (`moduleVocabulary.ts`).
 */
// Shop words only, each fitting one line on a 320 px phone (17 Nov 2026):
// "collections" wrapped and moved the page by 62 px every time it came round.
const TRUST_KEYS = [
  'landing.hero.trust.free',
  'landing.hero.trust.install',
  'landing.hero.trust.data',
] as const;

export const ROTATING_WORD_KEYS = [
  'landing.hero.word.dues',
  'landing.hero.word.bills',
  'landing.hero.word.stock',
  'landing.hero.word.purchases',
  'landing.hero.word.payments',
] as const;

/**
 * The first screen. Its text is never behind a reveal and never waits for a
 * script: the h1, the body and both buttons are in the server's HTML exactly as
 * they render, and the only thing that moves after hydration is the one
 * rotating word — which is `aria-hidden`, beside an `sr-only` sentence that
 * says every word, so the heading's accessible name is static and complete.
 *
 * On the right, a recording: the desktop loop in a tilted browser frame from
 * `lg`, the PHONE loop in a phone frame below it — a different recording, not
 * the desktop one shrunk. Both are in the DOM (so there is no layout shift when
 * the breakpoint is known) and `UbVideo`'s `media` makes sure only the visible
 * one is ever downloaded.
 */
function LandingHeroBase() {
  const { t } = useTranslation();
  const [before, after] = splitAroundWord(t('landing.hero.keyLine', { word: WORD_MARK }));
  const words = ROTATING_WORD_KEYS.map((key) => t(key));
  const videoLabels = {
    play: t('landing.video.play'),
    pause: t('landing.video.pause'),
    fallback: t('landing.video.fallback'),
  };

  return (
    <UbBox as="section" aria-labelledby="landing-hero-title" className="relative overflow-clip">
      <UbBox
        className={`${LANDING_CONTAINER} relative grid items-center gap-12 pb-12 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-10 lg:pb-16 lg:pt-20 xl:gap-16`}
      >
        <UbStack gap={6} align="start" className="min-w-0">
          <UbText
            as="span"
            variant="inherit"
            data-module-summary
            className="ds-body-s-medium inline-flex items-center gap-2 rounded-pill border border-border-hairline bg-surface-card/80 px-3 py-1.5 text-text-secondary shadow-sm backdrop-blur"
          >
            <UbBox as="span" aria-hidden className="h-2 w-2 rounded-full bg-action" />
            {t('landing.hero.badge')}
          </UbText>

          <UbText
            as="h1"
            id="landing-hero-title"
            variant="inherit"
            tone="primary"
            className="text-[clamp(2.375rem,1.45rem+3.4vw,3.875rem)] leading-[1.08]"
          >
            <UbText
              as="span"
              variant="inherit"
              tone="secondary"
              className={`${SERIF_LEAD} text-balance`}
            >
              {t('landing.hero.lead')}
            </UbText>
            <UbText as="span" variant="inherit" className="sr-only">
              {' '}
              {t('landing.hero.srLine')}
            </UbText>
          </UbText>
          {/* The rotating line is drawn OUTSIDE the h1 (17 Nov 2026 review): a
              crawler reads every word in a heading, and the six rotating words
              read as one jumbled run. The h1 is the lead and its full sentence. */}
          <UbText
            as="p"
            variant="inherit"
            aria-hidden
            className={`${SANS_KEY} -mt-5 text-[clamp(2.375rem,1.45rem+3.4vw,3.875rem)] leading-[1.08] text-text-primary`}
          >
            {before}
            <UbRotatingText words={words} className="text-text-accent" />
            {after}
          </UbText>

          <UbText
            variant="inherit"
            tone="secondary"
            data-module-summary
            className="max-w-[34rem] text-[clamp(1rem,0.95rem+0.3vw,1.1875rem)] leading-relaxed"
          >
            {t('landing.hero.body')}
          </UbText>

          <UbStack gap={3} className="w-full">
            <UbStack
              direction="row"
              wrap
              gap={3}
              className="w-full max-sm:flex-col max-sm:[&>*]:w-full"
            >
              <UbActionLink
                href={ROUTES.LOGIN}
                variant="primary"
                size="lg"
                className="ub-lift h-12 rounded-[14px] px-6 text-[1.0625rem]"
                data-testid="landing-hero-start"
              >
                {t('landing.nav.startFree')}
              </UbActionLink>
              {/* "See how it works" (owner, 17 Nov 2026): the step-by-step guides
                  for each business, with their videos, on /solutions. */}
              <UbActionLink
                href="/solutions"
                variant="outlineNeutral"
                size="lg"
                className="ub-lift h-12 gap-2 rounded-[14px] px-6 text-[1.0625rem]"
                data-testid="landing-demo-open"
              >
                <BookOpenCheck aria-hidden className="h-5 w-5 text-text-accent" />
                {t('landing.hero.demo')}
              </UbActionLink>
            </UbStack>
            {/* Three promises a shopkeeper can check before trying it, all true today. */}
            <UbStack as="ul" direction="row" wrap gap={2} className="gap-y-2">
              {TRUST_KEYS.map((key) => (
                <UbText
                  as="li"
                  key={key}
                  variant="inherit"
                  className="ds-body-s-medium inline-flex items-center gap-1.5 text-text-secondary"
                >
                  <CircleCheck aria-hidden className="h-4 w-4 shrink-0 text-text-accent" />
                  {t(key)}
                </UbText>
              ))}
            </UbStack>
            <UbText variant="body-sm" tone="tertiary">
              {t('landing.hero.micro')}
            </UbText>
          </UbStack>
        </UbStack>

        <UbBox className="relative min-w-0">
          <UbBox className="hidden lg:block">
            <UbDeviceFrame variant="browser" url="yourkhata.com" tilt>
              <UbVideo
                {...HERO_DESKTOP}
                alt={t('landing.hero.desktop.alt')}
                labels={videoLabels}
                media={DESKTOP_MEDIA}
                priority
              />
            </UbDeviceFrame>
          </UbBox>
          <UbBox className="mx-auto w-[min(76vw,19rem)] lg:hidden">
            <UbDeviceFrame variant="phone">
              <UbVideo
                {...HERO_MOBILE}
                alt={t('landing.hero.mobile.alt')}
                labels={videoLabels}
                media={MOBILE_MEDIA}
                priority
              />
            </UbDeviceFrame>
          </UbBox>
        </UbBox>
      </UbBox>
    </UbBox>
  );
}

LandingHeroBase.displayName = 'LandingHero';
export const LandingHero = memo(LandingHeroBase);
