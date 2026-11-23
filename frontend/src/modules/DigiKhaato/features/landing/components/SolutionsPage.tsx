import { GooglePublicTracker } from 'src/analytics/GooglePublicTracker';
import {
  UbAmbientGlow,
  UbActionLink,
  UbBox,
  UbDeviceFrame,
  UbDisclosure,
  UbJsonLd,
  UbLink,
  UbPicture,
  UbStack,
  UbText,
  UbVideo,
} from 'src/design-system';
import { ROUTES } from 'src/routes';
import { cn } from 'src/utils/cn';
import { absoluteUrl } from 'src/utils/seo';

import { LANDING_CONTAINER, LANDING_SCALE } from '../config/layout';
import { searchTermsFor } from '../config/searchTerms';
import { SOLUTIONS, solutionBySlug, type Solution, type SolutionGuide } from '../config/solutions';
import { HINDI_SLUGS, hindiSolutionBySlug } from '../config/solutions.hi';
import { isoDateTime } from '../utils/landingJsonLd';

import { BusinessSection } from './BusinessSection';
import { GuideFold } from './GuideFold';
import { LandingFooter } from './LandingClosing';
import { LandingHeader } from './LandingHeader';

/** English public pages: the video controls are labelled in the page's language. */
const VIDEO_LABELS = { play: 'Play video', pause: 'Pause video', fallback: 'Open the video' };
const CARD = 'rounded-[18px] border border-border-hairline bg-surface-card';
const SECTION_LABEL = 'uppercase tracking-[0.06em]';

type Lang = 'en' | 'hi';
/** Every fixed word on a guide page, per language (owner, 22 Nov 2026: Hindi pages). */
const COPY = {
  en: {
    startFree: 'Start free',
    seeGuides: 'See the step-by-step guides',
    noCard: 'Start with your mobile number and a code on WhatsApp. No card needed.',
    inShort: 'In short',
    whoFor: 'Who is it for?',
    problem: 'Keep daily records together',
    featuresLabel: 'Features',
    featuresTitle: 'What you can do',
    exampleLabel: 'Worked example',
    step: 'Step',
    casesLabel: 'Case studies',
    casesTitle: 'How it can be used',
    casesBody:
      'Illustrative examples, not customer stories. Names and figures are made up to show the workflow.',
    illustrative: 'Illustrative',
    questionsLabel: 'Questions',
    questionsTitle: 'Common questions',
    alsoSearched: 'Also searched as',
    home: 'Home',
    solutions: 'Solutions',
    otherKinds: 'Guides for other kinds of shop',
    yourKind: 'Guides for your kind of shop',
    otherModules: 'Other modules',
    otherModulesHub: 'Other modules and solutions',
    guidesCount: (n: number) => `${n} step-by-step guides with real phone and computer screens.`,
    ctaLending: 'Put your line register on your phone',
    cta: 'Start with your business records',
    ctaBody: 'YourKhata works in a browser on phone or computer, with nothing to install.',
    otherLanguage: 'हिंदी में पढ़ें',
  },
  hi: {
    startFree: 'मुफ़्त शुरू करें',
    seeGuides: '',
    noCard: 'मोबाइल नंबर और WhatsApp कोड से शुरू करें। कोई कार्ड नहीं चाहिए।',
    inShort: 'संक्षेप में',
    whoFor: 'यह किसके लिए है?',
    problem: 'रोज़ का हिसाब एक जगह',
    featuresLabel: 'सुविधाएँ',
    featuresTitle: 'आप क्या कर सकते हैं',
    exampleLabel: 'उदाहरण',
    step: 'कदम',
    casesLabel: 'उदाहरण',
    casesTitle: 'इसका इस्तेमाल कैसे हो सकता है',
    casesBody:
      'ये समझाने के लिए उदाहरण हैं, असली ग्राहकों की कहानियाँ नहीं। नाम और आँकड़े बनावटी हैं।',
    illustrative: 'उदाहरण',
    questionsLabel: 'सवाल',
    questionsTitle: 'आम सवाल',
    alsoSearched: 'लोग ऐसे भी खोजते हैं',
    home: 'होम',
    solutions: 'गाइड',
    otherKinds: 'दूसरी दुकानों की गाइड',
    yourKind: 'आपकी दुकान की गाइड',
    otherModules: 'दूसरे ऐप',
    otherModulesHub: 'दूसरे ऐप',
    guidesCount: () => '',
    ctaLending: 'अपना लाइन रजिस्टर फ़ोन पर रखें',
    cta: 'अपने व्यापार का हिसाब शुरू करें',
    ctaBody: 'YourKhata फ़ोन या कंप्यूटर के ब्राउज़र में चलता है, कुछ इंस्टॉल नहीं करना।',
    otherLanguage: 'Read in English',
  },
} as const;
const solutionPath = (slug: string, lang: Lang): string =>
  `${lang === 'hi' ? '/hi' : ''}/solutions/${slug}`;

const shot = (slug: string, size: 'phone' | 'desktop', name: string) =>
  `/media/guides/${solutionBySlug(slug)?.media ?? slug}/${size}-${name}`;

function Picture({
  base,
  phone,
  alt,
  eager,
}: Readonly<{ base: string; phone?: boolean; alt: string; eager?: boolean }>): React.JSX.Element {
  return (
    <UbPicture
      webp={`${base}.webp`}
      jpg={`${base}.jpg`}
      width={phone ? 780 : 1280}
      height={phone ? 1688 : 800}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      className="block h-auto w-full"
    />
  );
}

/** A guide's two screenshots: the phone in front, the computer behind it. */
/** The home page's silent loop for this job, tap to play: recorded in the demo general store. */
function GuideClip({ clip, title }: Readonly<{ clip: string; title: string }>) {
  const base = `/media/landing/${clip}`;
  const sources = (size: 'desktop' | 'mobile') => [
    { src: `${base}-${size}.webm`, type: 'video/webm; codecs=vp9' },
    { src: `${base}-${size}.mp4`, type: 'video/mp4' },
  ];
  const poster = (size: 'desktop' | 'mobile') => ({
    webp: `${base}-${size}-poster.webp`,
    jpg: `${base}-${size}-poster.jpg`,
  });
  return (
    <UbStack gap={2}>
      <UbText variant="body-sm-medium" tone="secondary">
        Watch it done · recorded in our demo general store
      </UbText>
      <UbBox className="overflow-hidden rounded-[14px] border border-border-hairline max-md:hidden">
        <UbVideo
          sources={sources('desktop')}
          poster={poster('desktop')}
          width={1280}
          height={800}
          alt={`${title}, recorded on a computer`}
          labels={VIDEO_LABELS}
          media="(min-width: 768px)"
          autoPlay={false}
        />
      </UbBox>
      <UbBox className="mx-auto w-[min(62%,230px)] overflow-hidden rounded-[22px] border border-border-hairline md:hidden">
        <UbVideo
          sources={sources('mobile')}
          poster={poster('mobile')}
          width={584}
          height={1264}
          alt={`${title}, recorded on a phone`}
          labels={VIDEO_LABELS}
          media="(max-width: 767.98px)"
          autoPlay={false}
        />
      </UbBox>
    </UbStack>
  );
}

function GuideShots({
  slug,
  guide,
}: Readonly<{ slug: string; guide: SolutionGuide }>): React.JSX.Element {
  return (
    <UbBox className="relative rounded-[18px] bg-[radial-gradient(80%_80%_at_70%_30%,var(--accent-quiet),transparent_75%)] p-4 md:p-6">
      <UbBox className="mr-[26%] overflow-hidden rounded-lg border border-border-hairline shadow-sm max-md:hidden">
        <Picture base={shot(slug, 'desktop', guide.shot)} alt={`${guide.alt} (computer)`} />
      </UbBox>
      <UbBox className="mx-auto w-[min(62%,230px)] overflow-hidden rounded-[22px] border border-border-hairline shadow-lg md:absolute md:bottom-4 md:right-6 md:w-[22%]">
        <Picture base={shot(slug, 'phone', guide.shot)} phone alt={`${guide.alt} (phone)`} />
      </UbBox>
    </UbBox>
  );
}

function SectionHead({
  label,
  title,
  body,
}: Readonly<{ label?: string; title: string; body?: string }>): React.JSX.Element {
  return (
    <UbStack gap={2} className="max-w-2xl">
      {label ? (
        <UbText variant="caption" tone="accent" className={SECTION_LABEL}>
          {label}
        </UbText>
      ) : null}
      <UbText as="h2" variant="h2">
        {title}
      </UbText>
      {body ? <UbText tone="secondary">{body}</UbText> : null}
    </UbStack>
  );
}

function SolutionDetail({
  solution,
  lang,
}: Readonly<{ solution: Solution; lang: Lang }>): React.JSX.Element {
  const t = COPY[lang];
  // The step-by-step guides are photographed in English: the Hindi page keeps
  // their pictures for the hero and links to the English page for the steps.
  const allGuides = solution.guides ?? [];
  const guides = lang === 'hi' ? [] : allGuides;
  const hero = allGuides.find((g) => g.shot === 'today' || g.shot === 'dashboard') ?? allGuides[0];
  const video = solution.video;
  return (
    <>
      <UbBox
        as="section"
        className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
      >
        <UbStack gap={5}>
          <UbText variant="caption" tone="accent" className={SECTION_LABEL}>
            {solution.title.replace(/ \| YourKhata$/, '')}
          </UbText>
          <UbText as="h1" variant="h1">
            {solution.name}
          </UbText>
          <UbText variant="body" tone="secondary">
            {solution.description}
          </UbText>
          <UbStack direction="row" wrap gap={3}>
            <UbActionLink href={ROUTES.LOGIN} variant="primary">
              {t.startFree}
            </UbActionLink>
            {guides.length ? (
              <UbActionLink href="#guides" variant="secondary">
                {t.seeGuides}
              </UbActionLink>
            ) : null}
          </UbStack>
          {solution.highlights?.length ? (
            <UbStack as="ul" direction="row" wrap gap={2}>
              {solution.highlights.map((h) => (
                <UbBox
                  as="li"
                  key={h}
                  className="rounded-full border border-border-hairline bg-surface-card px-3 py-1"
                >
                  <UbText variant="body-sm">✓ {h}</UbText>
                </UbBox>
              ))}
            </UbStack>
          ) : null}
          <UbText variant="caption" tone="secondary">
            {t.noCard}
          </UbText>
        </UbStack>
        {hero ? (
          <UbBox className="relative pb-6 pr-6">
            <UbDeviceFrame
              variant="browser"
              url="yourkhata.com"
              tilt
              className="w-full max-md:hidden"
            >
              <Picture
                base={shot(solution.slug, 'desktop', hero.shot)}
                alt={`${hero.alt} (computer)`}
                eager
              />
            </UbDeviceFrame>
            <UbBox className="mx-auto w-[min(70%,260px)] md:absolute md:-bottom-2 md:right-0 md:w-[32%]">
              <UbDeviceFrame variant="phone">
                <Picture
                  base={shot(solution.slug, 'phone', hero.shot)}
                  phone
                  alt={`${hero.alt} (phone)`}
                  eager
                />
              </UbDeviceFrame>
            </UbBox>
          </UbBox>
        ) : null}
      </UbBox>

      {solution.summary ? (
        <UbBox as="section" className={`${CARD} border-l-4 border-l-[var(--accent)] p-6 md:p-8`}>
          <UbText as="h2" variant="h3">
            {t.inShort}
          </UbText>
          <UbText className="mt-3">{solution.summary}</UbText>
        </UbBox>
      ) : null}

      <UbBox as="section" className="grid gap-6 md:grid-cols-2">
        <UbStack gap={3} className={`${CARD} p-6`}>
          <UbText as="h2" variant="h3">
            {t.whoFor}
          </UbText>
          <UbText tone="secondary">{solution.audience}</UbText>
        </UbStack>
        <UbStack gap={3} className={`${CARD} p-6`}>
          <UbText as="h2" variant="h3">
            {t.problem}
          </UbText>
          <UbText tone="secondary">{solution.problem}</UbText>
        </UbStack>
      </UbBox>

      <UbStack as="section" gap={6}>
        <SectionHead label={t.featuresLabel} title={t.featuresTitle} />
        <UbBox as="ul" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {solution.features.map((feature, index) => (
            <UbStack as="li" key={feature} gap={3} className={`${CARD} p-5`}>
              <UbText
                variant="body-sm-medium"
                tone="accent"
                className="flex size-8 items-center justify-center rounded-full bg-[var(--accent-quiet)]"
              >
                {index + 1}
              </UbText>
              <UbText>{feature}</UbText>
            </UbStack>
          ))}
        </UbBox>
      </UbStack>

      {video ? (
        <UbStack as="section" id="video" gap={6}>
          <SectionHead label="Video" title={video.title} body={video.description} />
          <UbBox className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,0.38fr)]">
            <UbDeviceFrame variant="browser" url="yourkhata.com" className="w-full max-md:hidden">
              <UbVideo
                sources={[
                  { src: `${video.base}-desktop.webm`, type: 'video/webm; codecs=vp9' },
                  { src: `${video.base}-desktop.mp4`, type: 'video/mp4' },
                ]}
                poster={{ webp: `${video.base}-desktop.webp`, jpg: `${video.base}-desktop.jpg` }}
                width={1280}
                height={800}
                alt={`${video.title} (computer)`}
                labels={VIDEO_LABELS}
                media="(min-width: 768px)"
              />
            </UbDeviceFrame>
            <UbBox className="mx-auto w-[min(76%,280px)] md:w-full">
              <UbDeviceFrame variant="phone">
                <UbVideo
                  sources={[
                    { src: `${video.base}-phone.webm`, type: 'video/webm; codecs=vp9' },
                    { src: `${video.base}-phone.mp4`, type: 'video/mp4' },
                  ]}
                  poster={{ webp: `${video.base}-phone.webp`, jpg: `${video.base}-phone.jpg` }}
                  width={390}
                  height={844}
                  alt={`${video.title} (phone)`}
                  labels={VIDEO_LABELS}
                />
              </UbDeviceFrame>
            </UbBox>
          </UbBox>
        </UbStack>
      ) : null}

      {solution.example ? (
        <UbStack as="section" gap={6}>
          <SectionHead label={t.exampleLabel} title={solution.example.title} />
          <UbStack as="ol" gap={4} className="grid md:grid-cols-3">
            {solution.example.steps.map((step, index) => (
              <UbStack as="li" key={step} gap={2} className={`${CARD} p-6`}>
                <UbText variant="body-sm-medium" tone="accent">
                  {t.step} {index + 1}
                </UbText>
                <UbText>{step}</UbText>
              </UbStack>
            ))}
          </UbStack>
        </UbStack>
      ) : null}

      {guides.length ? (
        <UbStack as="section" id="guides" gap={6}>
          <SectionHead
            label="User guide"
            title="Step-by-step guides"
            body="Real screens from a demo business, on a phone and on a computer. Names and amounts are made up."
          />
          <UbBox className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
            <UbBox as="nav" aria-label="Guides" className="lg:sticky lg:top-6 lg:self-start">
              <UbStack as="ol" gap={1} className="max-lg:flex max-lg:flex-wrap max-lg:gap-2">
                {guides.map((guide, index) => (
                  <UbBox as="li" key={guide.id}>
                    <UbLink
                      href={`#${guide.id}`}
                      underline={false}
                      className="block rounded-lg px-3 py-2 hover:bg-surface-subtle max-lg:border max-lg:border-border-hairline"
                    >
                      {index + 1}. {guide.title}
                    </UbLink>
                  </UbBox>
                ))}
              </UbStack>
            </UbBox>
            <UbStack gap={8}>
              {guides.map((guide, index) => (
                <GuideFold
                  key={guide.id}
                  id={guide.id}
                  index={index}
                  title={guide.title}
                  className={`${CARD} grid scroll-mt-24 gap-4 p-5 md:gap-6 md:p-6`}
                >
                  <UbStack as="ol" gap={3}>
                    {guide.steps.map((step, n) => (
                      <UbStack as="li" key={step} direction="row" gap={3} align="start">
                        <UbText
                          variant="caption"
                          tone="accent"
                          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-quiet)]"
                        >
                          {n + 1}
                        </UbText>
                        <UbText>{step}</UbText>
                      </UbStack>
                    ))}
                  </UbStack>
                  <GuideShots slug={solution.slug} guide={guide} />
                  {guide.clip ? <GuideClip clip={guide.clip} title={guide.title} /> : null}
                </GuideFold>
              ))}
            </UbStack>
          </UbBox>
        </UbStack>
      ) : null}

      {solution.cases?.length ? (
        <UbStack as="section" gap={6}>
          <SectionHead label={t.casesLabel} title={t.casesTitle} body={t.casesBody} />
          <UbBox className="grid gap-4 md:grid-cols-2">
            {solution.cases.map(({ title: caseTitle, body }) => (
              <UbStack as="article" key={caseTitle} gap={2} className={`${CARD} p-6`}>
                <UbText variant="caption" tone="warning">
                  {t.illustrative}
                </UbText>
                <UbText as="h3" variant="h3">
                  {caseTitle}
                </UbText>
                <UbText tone="secondary">{body}</UbText>
              </UbStack>
            ))}
          </UbBox>
        </UbStack>
      ) : null}

      {solution.limits?.length ? (
        <UbStack as="section" gap={4} className={`${CARD} bg-surface-subtle p-6 md:p-8`}>
          <UbText as="h2" variant="h3">
            {solution.limitsTitle}
          </UbText>
          <UbStack as="ul" gap={2} className="list-disc pl-6">
            {solution.limits.map((limit) => (
              <UbBox as="li" key={limit}>
                <UbText>{limit}</UbText>
              </UbBox>
            ))}
          </UbStack>
        </UbStack>
      ) : null}

      <UbStack as="section" gap={6}>
        <SectionHead label={t.questionsLabel} title={t.questionsTitle} />
        <UbStack gap={3}>
          {solution.questions.map(({ question, answer }, index) => (
            <UbDisclosure
              key={question}
              label={question}
              defaultOpen={index === 0}
              keepMounted
              className={`${CARD} px-5 py-2`}
            >
              <UbText tone="secondary" className="pb-3">
                {answer}
              </UbText>
            </UbDisclosure>
          ))}
        </UbStack>
      </UbStack>

      {searchTermsFor(solution.slug).length ? (
        <UbStack as="section" gap={2} data-testid="solution-search-terms">
          <UbText variant="body-sm-medium" tone="secondary">
            {t.alsoSearched}
          </UbText>
          <UbText tone="secondary">{searchTermsFor(solution.slug).join(' · ')}</UbText>
        </UbStack>
      ) : null}
    </>
  );
}

const isShopKind = (entry: Solution): boolean => entry.media?.startsWith('shop/') ?? false;

/** The guides hub groups every kind of shop together; a page offers its siblings first. */
const GROUPS = (
  lang: Lang,
  current?: Solution
): readonly { title: string; entries: readonly Solution[] }[] => {
  const t = COPY[lang];
  const all =
    lang === 'hi' ? HINDI_SLUGS.flatMap((slug) => hindiSolutionBySlug(slug) ?? []) : SOLUTIONS;
  const others = all.filter((entry) => entry.slug !== current?.slug);
  const kinds = others.filter(isShopKind);
  const modules = others.filter((entry) => !isShopKind(entry));
  const kindsTitle = current && isShopKind(current) ? t.otherKinds : t.yourKind;
  const groups = [
    { title: kindsTitle, entries: kinds },
    { title: current ? t.otherModules : t.otherModulesHub, entries: modules },
  ];
  return current && !isShopKind(current) ? [...groups].reverse() : groups;
};

export function SolutionsPage({
  solution,
  lang = 'en',
}: Readonly<{ solution?: Solution; lang?: Lang }>): React.JSX.Element {
  const t = COPY[lang];
  const path = solution ? solutionPath(solution.slug, lang) : '/solutions';
  const title = solution?.name ?? 'Business solutions on one shared platform';
  const video = solution?.video;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${absoluteUrl(path)}#page`,
        url: absoluteUrl(path),
        name: title,
        description:
          solution?.description ??
          'Explore YourKhata modules for billing, inventory, libraries and lending records.',
        isPartOf: { '@id': `${absoluteUrl('/')}#website` },
        inLanguage: lang === 'hi' ? 'hi-IN' : 'en-IN',
        ...(solution && searchTermsFor(solution.slug).length
          ? { keywords: searchTermsFor(solution.slug).join(', ') }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'YourKhata', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: t.solutions, item: absoluteUrl('/solutions') },
          ...(solution
            ? [{ '@type': 'ListItem', position: 3, name: solution.name, item: absoluteUrl(path) }]
            : []),
        ],
      },
      ...(lang === 'hi' ? [] : (solution?.guides ?? [])).map((guide) => ({
        '@type': 'HowTo',
        '@id': `${absoluteUrl(path)}#${guide.id}`,
        name: guide.title,
        image: absoluteUrl(`${shot(solution?.slug ?? '', 'phone', guide.shot)}.jpg`),
        step: guide.steps.map((text, index) => ({
          '@type': 'HowToStep',
          position: index + 1,
          text,
        })),
      })),
      ...(video
        ? [
            {
              '@type': 'VideoObject',
              '@id': `${absoluteUrl(path)}#video`,
              name: video.title,
              description: video.description,
              thumbnailUrl: absoluteUrl(`${video.base}-desktop.jpg`),
              contentUrl: absoluteUrl(`${video.base}-desktop.mp4`),
              uploadDate: isoDateTime(video.recorded),
              duration: `PT${video.seconds}S`,
              inLanguage: 'en-IN',
            },
          ]
        : []),
      ...(solution
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: solution.questions.map(({ question, answer }) => ({
                '@type': 'Question',
                name: question,
                acceptedAnswer: { '@type': 'Answer', text: answer },
              })),
            },
          ]
        : []),
    ],
  };
  return (
    <UbBox
      lang={lang}
      className={cn(
        'relative min-h-dvh overflow-x-clip bg-canvas text-text-primary',
        LANDING_SCALE
      )}
    >
      <UbJsonLd data={graph} />
      <GooglePublicTracker />
      {/* The home page's own shell: its glow, floating header and footer. */}
      <UbAmbientGlow className="bottom-auto h-[min(900px,calc(100dvh+200px))]" />
      <LandingHeader base="/" />
      <UbStack
        as="main"
        id="main"
        gap={10}
        className={`${LANDING_CONTAINER} relative py-8 md:py-14`}
      >
        <UbBox as="nav" aria-label="Breadcrumb">
          <UbText variant="body-sm" tone="secondary">
            <UbLink href="/" className="inline-flex min-h-11 items-center">
              {t.home}
            </UbLink>
            {' / '}
            <UbLink href="/solutions" className="inline-flex min-h-11 items-center">
              {t.solutions}
            </UbLink>
            {solution ? ` / ${solution.name}` : ''}
          </UbText>
          {solution ? (
            <UbLink
              href={solutionPath(solution.slug, lang === 'hi' ? 'en' : 'hi')}
              hrefLang={lang === 'hi' ? 'en' : 'hi'}
              className="inline-flex min-h-11 items-center"
              data-testid="solution-other-language"
            >
              {t.otherLanguage}
            </UbLink>
          ) : null}
        </UbBox>
        {solution ? (
          <SolutionDetail solution={solution} lang={lang} />
        ) : (
          <>
            <UbText as="h1" variant="h1">
              {title}
            </UbText>
            <UbText variant="body" tone="secondary">
              Pick your business to see step-by-step guides with real screens, on phone and
              computer.
            </UbText>
            {/* Moved here from the home page (owner, 17 Nov 2026). */}
            <BusinessSection bare />
          </>
        )}
        {(solution ? GROUPS(lang, solution) : []).map((group) => (
          <UbStack as="section" gap={6} key={group.title}>
            <SectionHead title={group.title} />
            <UbBox className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.entries.map((entry) => (
                <UbBox key={entry.slug} className={`${CARD} p-6`}>
                  <UbText as="h3" variant="h3">
                    <UbLink
                      href={solutionPath(entry.slug, lang)}
                      variant="h3"
                      className="inline-flex min-h-11 items-center"
                    >
                      {entry.name}
                    </UbLink>
                  </UbText>
                  <UbText tone="secondary" className="mt-3">
                    {entry.guides?.length && lang === 'en'
                      ? t.guidesCount(entry.guides.length)
                      : entry.description}
                  </UbText>
                </UbBox>
              ))}
            </UbBox>
          </UbStack>
        ))}
        <UbStack
          as="section"
          gap={4}
          align="start"
          className="rounded-[18px] bg-[var(--accent-quiet)] p-6 md:p-10"
        >
          <UbText as="h2" variant="h2">
            {solution?.slug === 'lending-collections' ? t.ctaLending : t.cta}
          </UbText>
          <UbText>{t.ctaBody}</UbText>
          <UbActionLink href={ROUTES.LOGIN} variant="primary">
            {t.startFree}
          </UbActionLink>
        </UbStack>
      </UbStack>
      <LandingFooter base="/" />
    </UbBox>
  );
}
