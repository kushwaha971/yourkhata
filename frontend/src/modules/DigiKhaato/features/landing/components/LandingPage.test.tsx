import { act, fireEvent, screen, within } from '@testing-library/react';

import { ThemeProvider } from 'src/components/providers/ThemeProvider';
import { themeRestored } from 'src/redux/slice/themeSlice';
import { store } from 'src/redux/store';
import { en as enMessages, hi as hiMessages } from 'src/tests/allMessages';
import {
  COMPARATIVE_CLAIMS,
  LANDING_JARGON,
  MODULE_WORDS,
  STATUS_WORDS,
  namesACompetitor,
  withoutBrand,
} from 'src/tests/moduleVocabulary';
import { renderWithProviders } from 'src/tests/renderWithProviders';
import { THEME_CHOICE_COOKIE } from 'src/utils/cookieUtils';

import { FEATURE_CLIPS } from '../config/media';
import { LANDING_MODULES, VISIBLE_MODULES } from '../config/modules';
import { PRICING, YEARLY_BILLED_MONTHS, priceFor, yearlyPrice } from '../config/pricing';
import {
  LANDING_DESCRIPTION,
  LANDING_SHARE_DESCRIPTION,
  LANDING_SHARE_TITLE,
  LANDING_TITLE,
} from '../config/seo';

import { splitAroundWord } from './LandingHero';
import { ModuleStage } from './LandingModuleParts';
import { LandingPage } from './LandingPage';
import { ThemeToggle } from './LandingToggles';
import { PricingSection } from './PricingSection';

/**
 * The landing page is the product's only public claim about itself, so the
 * tests are mostly about what it must NOT say or do: promise a price that is
 * charged, say "most popular" about plans nobody has bought, lose a CTA's
 * destination, or give the heading an accessible name that changes every two
 * seconds.
 */
beforeEach(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: jest.fn(() => Promise.resolve()),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: jest.fn(),
  });
});

const renderPage = () => renderWithProviders(<LandingPage />);

describe('LandingPage', () => {
  /**
   * The rotating word is decoration: the heading's accessible name must be the
   * complete sentence, once, whatever word is showing.
   */
  it('names the hero heading with the full static sentence', () => {
    renderPage();

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveAccessibleName(
      "Your shop's records, on your phone. Track dues, GST bills, stock, purchases and payments."
    );
    // The rotating words sit OUTSIDE the h1 (17 Nov 2026): a crawler reads the
    // heading's every word, and six rotating ones read as a jumble.
    expect(within(h1).queryByTestId('ub-rotator')).toBeNull();
    expect(h1.textContent).toBe(
      "Your shop's records, on your phone. Track dues, GST bills, stock, purchases and payments."
    );
    expect(screen.getByTestId('ub-rotator').closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows the badge, the support copy and the micro-copy under the CTAs', () => {
    renderPage();

    expect(screen.getByText('For shops and businesses in India')).toBeInTheDocument();
    // Three promises under Start free, each true today.
    ['Free to start', 'Nothing to install', 'Download your data anytime'].forEach((promise) =>
      expect(screen.getByText(promise)).toBeInTheDocument()
    );
    // DEC-013: sign-up is a mobile number and a code. The page said "email"
    // in four places for a day after the sign-in screen stopped asking for one.
    expect(screen.getByText('Start with your mobile number. No card needed.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/sign up with email|email and a password/i);
  });

  /** No billing exists, so every "Start free" goes to sign-up and nowhere else. */
  it('sends every Start free to /login (one page for everyone, owner 12 Nov 2026) and every Log in to /login', () => {
    renderPage();

    const starts = screen.getAllByRole('link', { name: /^Start free/ });
    // header, hero, closing band (pricing is hidden; nothing is charged
    // today, so "Start free" is true and stays)
    expect(starts.length).toBeGreaterThanOrEqual(3);
    starts.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
    screen
      .getAllByRole('link', { name: 'Log in' })
      .forEach((link) => expect(link).toHaveAttribute('href', '/login'));
    // The owner removed the Legal footer section; direct legal routes remain available.
    expect(screen.queryByRole('navigation', { name: 'Legal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Terms' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Privacy' })).not.toBeInTheDocument();
  });

  it('links every anchor in the header to a section that exists', () => {
    const { container } = renderPage();
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0] as HTMLElement;

    const hrefs = within(nav)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    // The last link leaves the page for the step-by-step guides (17 Nov 2026).
    expect(hrefs).toEqual(['#features', '#faq', '/solutions']);
    hrefs
      .filter((href) => href?.startsWith('#'))
      .forEach((href) => expect(container.querySelector(href as string)).not.toBeNull());
  });

  it('lists the six everyday jobs and leaves choosing a business to the guides', () => {
    const { container } = renderPage();

    // The business tiles moved to /solutions (owner, 17 Nov 2026).
    expect(container.querySelector('#business')).toBeNull();
    expect(
      within(container.querySelector('#features') as HTMLElement)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent)
    ).toEqual([
      'Make a GST bill',
      'Keep credit straight',
      'Remind who owes you',
      'Know your stock',
      'Record purchases',
      'Close the day',
    ]);
  });

  it('answers eleven questions in the FAQ, e-invoicing and reminders honestly', () => {
    renderPage();
    const faq = document.getElementById('faq') as HTMLElement;

    const questions = within(faq).getAllByRole('button');
    expect(questions).toHaveLength(11);
    // What it is and how you get in come first: the two things a cold visitor asks.
    expect(questions[0]).toHaveTextContent('What is YourKhata?');
    expect(questions[1]).toHaveTextContent('How do I start and log in?');
    fireEvent.click(within(faq).getByRole('button', { name: 'Does it support e-invoicing?' }));
    expect(within(faq).getByText(/^Not today\./)).toBeInTheDocument();
    // A reminder is prepared, never sent for the merchant (DEC-012).
    fireEvent.click(
      within(faq).getByRole('button', { name: 'Can I remind customers on WhatsApp?' })
    );
    expect(within(faq).getByText(/press send; nothing is sent without you/)).toBeInTheDocument();
  });

  /**
   * Nothing on this page may claim a user count, a rating or a testimonial —
   * checked on the RENDERED text, so a hard-coded string cannot slip past the
   * catalogue check in unbuiltFeatureCopy.test.ts.
   */
  it('renders no testimonial, rating, user count or popularity claim', () => {
    const { container } = renderPage();
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/most popular|testimonial|rating|★|trusted by|loved by/i);
    expect(text).not.toMatch(/\d[\d,]*\+?\s*(users|shops|merchants|businesses)\b/i);
    expect(text).not.toMatch(/\d\s*%/);
  });

  /**
   * The narrated film left the home page (owner, 17 Nov 2026): it will play on
   * YouTube, and each feature's video sits with its guide. The hero's second
   * button is "See how it works" and opens the guides.
   */
  it('carries no film, and sends See how it works to the guides', () => {
    const { container } = renderPage();
    expect(container.querySelector('#demo')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    const demo = screen.getByTestId('landing-demo-open');
    expect(demo).toHaveAttribute('href', '/solutions');
    expect(demo).toHaveTextContent('See how it works');
  });
});

/**
 * CR-2026-09-29-PLATFORM-D — one platform, many modules, every module
 * presented the same way as part of the product. The rules that keep that
 * honest: no status label anywhere, and nothing invented — a module with no
 * recordings shows words and an icon illustration, never a screen.
 */
describe('the module story', () => {
  /** Anything a picture could be, outside decoration drawn from our own icon set. */
  const visualMedia = (el: HTMLElement) =>
    [...el.querySelectorAll('video, img, picture, source, iframe, canvas, svg')].filter(
      (node) => !node.closest('[aria-hidden="true"]')
    );

  /**
   * The owner's rule: no Live, Planned or In development — as a chip, a
   * caption, a heading or an attribute — in either language. `status` stays in
   * the config for the pre-launch check and the page renders nothing from it.
   */
  it.each(['en', 'hi'] as const)(
    'renders no status chip, status attribute or status wording (%s)',
    (locale) => {
      const { container } = renderWithProviders(<LandingPage />, { locale });

      expect(
        container.querySelector('[data-module-status], [data-testid^="landing-status-"]')
      ).toBeNull();
      // The offline desktop section left the home page on 17 Nov 2026, so the
      // whole page is held to the rule now.
      const text = container.textContent ?? '';
      expect(text).not.toMatch(STATUS_WORDS[locale]);
      if (locale === 'en')
        expect(text).not.toMatch(/one module today|more planned|planned to help/i);
    }
  );

  /**
   * No screenshot, no video, no mock UI and no figure for a module without
   * recordings: its stage is an illustration made of our own icons (aria-hidden
   * decoration). Gym and Hotel are the two without recordings and are hidden
   * from the page, so the rule is checked on the stage itself — which is what
   * draws them the day they are shown again.
   */
  it('gives a module without media no video or image, only its illustration', () => {
    const withoutMedia = LANDING_MODULES.filter((module) => !module.media);
    expect(withoutMedia.map((module) => module.id)).toEqual(['gym', 'hotel']);

    const labels = { play: 'Play video', pause: 'Pause video', fallback: 'Open the video' };
    withoutMedia.forEach((module) => {
      const { container, unmount } = renderWithProviders(
        <ModuleStage id={module.id} t={(id) => id} videoLabels={labels} />
      );
      expect(
        container.querySelector(
          '[data-module-stage="illustration"] [data-module-illustration][aria-hidden="true"]'
        )
      ).not.toBeNull();
      expect(visualMedia(container)).toHaveLength(0);
      expect(container.querySelector('[data-device], video, img')).toBeNull();
      unmount();
    });
  });

  /**
   * "When a module ships, its real recordings are added through the config"
   * (vision §4): the SAME stage, given `media` for another module, draws the
   * frame and drops the illustration. No component changes.
   */
  it("turns any module's illustration into its recording when the config gives it media", () => {
    const labels = { play: 'Play video', pause: 'Pause video', fallback: 'Open the video' };
    const t = (key: string) => key;
    const { container, rerender } = renderWithProviders(
      <ModuleStage id="library" t={t} videoLabels={labels} />
    );
    expect(container.querySelector('[data-module-illustration]')).not.toBeNull();
    expect(container.querySelector('video, [data-device]')).toBeNull();

    rerender(
      <ModuleStage
        id="library"
        media={{ clip: FEATURE_CLIPS.khata.desktop, altKey: 'landing.uc.khata.alt' }}
        t={t}
        videoLabels={labels}
      />
    );
    expect(
      container.querySelector('[data-module-stage="media"] [data-device="browser"] video')
    ).not.toBeNull();
    expect(container.querySelector('[data-module-illustration]')).toBeNull();
  });

  /**
   * A module's own words render only in that module's own elements, or in the
   * FAQ answer that names every module — the rendered form of the catalogue
   * rule in `unbuiltFeatureCopy.test.ts`, so a hard-coded string cannot slip
   * past it. In both languages.
   */
  it.each(['en', 'hi'] as const)(
    "renders each module's words only inside that module (%s)",
    (locale) => {
      const { container } = renderWithProviders(<LandingPage />, { locale });
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      const outside: string[] = [];
      const inside = new Set<string>();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        Object.entries(MODULE_WORDS).forEach(([id, words]) => {
          if (!words[locale].test(text)) return;
          if (node.parentElement?.closest(`[data-module-id="${id}"], [data-module-summary]`))
            inside.add(id);
          else outside.push(`${id}: ${text}`);
        });
      }
      expect(outside).toEqual([]);
      // Not vacuous: every VISIBLE module's words were found, in their own place
      // — and a hidden module's words were found nowhere at all.
      expect([...inside].sort()).toEqual(
        VISIBLE_MODULES.map((module) => module.id)
          .filter((id) => id in MODULE_WORDS)
          .sort()
      );
    }
  );

  /** Vision §4: no "kirana" and no regional jargon, in the text or any attribute. */
  it.each(['en', 'hi'] as const)(
    'uses no regional jargon, in text or attributes (%s)',
    (locale) => {
      const { container } = renderWithProviders(<LandingPage />, { locale });
      const pattern = locale === 'en' ? LANDING_JARGON.en : LANDING_JARGON.hi;
      // The attributes a person reads or hears. Ids and file paths such as
      // `feat-khata-desktop.webm` are code, and the recordings keep their names.
      const READABLE = ['alt', 'aria-label', 'title', 'placeholder', 'aria-description'];
      const attributes = [...container.querySelectorAll('*')].flatMap((el) =>
        READABLE.map((name) => el.getAttribute(name)).filter((value): value is string => !!value)
      );

      expect(withoutBrand(container.textContent ?? '')).not.toMatch(pattern);
      expect(attributes.filter((value) => pattern.test(withoutBrand(value)))).toEqual([]);
    }
  );

  /**
   * The page's `<title>` and description are copy too, and are not in the
   * catalogue. They live in `config/seo.ts` (CR-2026-09-29-PLATFORM-C), so
   * this reads the VALUES rather than slicing `app/page.tsx`'s source, which
   * would pass on a file that only names the constants. `src/tests/seo.test.tsx`
   * has the lengths.
   */
  it('keeps "kirana" and jargon out of the metadata', () => {
    for (const text of [
      LANDING_TITLE,
      LANDING_DESCRIPTION,
      LANDING_SHARE_TITLE,
      LANDING_SHARE_DESCRIPTION,
    ]) {
      expect(withoutBrand(text)).not.toMatch(LANDING_JARGON.en);
    }
  });

  it('says under the plans that plans for the other modules are added there', () => {
    renderWithProviders(<PricingSection />);

    expect(screen.getByTestId('landing-pricing-modules')).toHaveTextContent(
      'These plans cover Business & billing. Plans for the other modules will be added here.'
    );
  });
});

/**
 * "Why YourKhata" (#why, owner request 29 Sep 2026): what other apps commonly
 * miss, and what YourKhata does instead. Rendered, in both languages, so a
 * hard-coded string cannot slip past the catalogue checks.
 */
describe('Why YourKhata', () => {
  // The four the home page keeps (17 Nov 2026), in its order.
  const HEADINGS = {
    en: [
      'Any phone or computer',
      'Payments come straight to you',
      'Mistakes are corrected, never erased',
      'Your data stays yours',
    ],
    hi: [
      'कोई भी फ़ोन या कंप्यूटर',
      'पैसा सीधे आपके पास',
      'गलती सुधरती है, मिटती नहीं',
      'आपका डेटा आपका ही',
    ],
  } as const;

  it.each(['en', 'hi'] as const)(
    'renders every point as a contrast, with no competitor named (%s)',
    (locale) => {
      const { container } = renderWithProviders(<LandingPage />, { locale });
      const section = container.querySelector('#why') as HTMLElement;
      expect(section).not.toBeNull();
      expect(section).toHaveAttribute('aria-labelledby', 'landing-why-title');

      const cards = [...section.querySelectorAll<HTMLElement>('article[data-why-id]')];
      expect(cards.map((card) => card.dataset.whyId)).toEqual([
        'anywhere',
        'payments',
        'corrections',
        'data',
      ]);
      expect(
        within(section)
          .getAllByRole('heading', { level: 3 })
          .map((h) => h.textContent)
      ).toEqual([...HEADINGS[locale]]);
      // Every card names the failing in words, not only with the ✕.
      const missLabel = locale === 'en' ? 'Often elsewhere' : 'अक्सर दूसरी जगह';
      cards.forEach((card) => expect(within(card).getByText(missLabel)).toBeInTheDocument());

      const text = section.textContent ?? '';
      expect(namesACompetitor(text, locale)).toBe(false);
      expect(text).not.toMatch(COMPARATIVE_CLAIMS[locale]);
      // Words and our own icons only: no screenshot, no video.
      expect(section.querySelector('video, img, picture, iframe, [data-device]')).toBeNull();
    }
  );

  it('sits after the jobs, and is not in the trimmed menu', () => {
    const { container } = renderPage();
    const ids = [...container.querySelectorAll('main section[id]')].map((el) => el.id);
    // Reading order (17 Nov 2026): what it does, then why. The menu keeps the
    // essentials only, so Why is reached by scrolling.
    expect(ids.slice(0, 2)).toEqual(['features', 'why']);
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0] as HTMLElement;
    expect(within(nav).queryByRole('link', { name: 'Why YourKhata' })).toBeNull();
  });

  it('names no competitor anywhere on the rendered page, in either language', () => {
    (['en', 'hi'] as const).forEach((locale) => {
      const { container, unmount } = renderWithProviders(<LandingPage />, { locale });
      expect(namesACompetitor(container.textContent ?? '', locale)).toBe(false);
      unmount();
    });
  });
});

describe('PricingSection', () => {
  /**
   * The plans name their lines by short id (config/pricing.ts), so the section
   * builds each message id at render; every one it can build must exist.
   */
  it('has every plan line in both languages', () => {
    const keys = PRICING.plans.flatMap((plan) => [
      `landing.pricing.${plan.includes}`,
      ...plan.features.map((feature) => `landing.pricing.f.${feature}`),
    ]);
    keys.forEach((key) => {
      expect({
        key,
        en: !!(enMessages as Record<string, string>)[key],
        hi: !!(hiMessages as Record<string, string>)[key],
      }).toEqual({
        key,
        en: true,
        hi: true,
      });
    });
  });

  /**
   * Nothing is charged today. While the figures are `proposed`, the page says
   * so in words beside them; once approved, the notice goes and nothing else
   * changes.
   */
  it('shows the proposed-pricing notice while the plans are proposed', () => {
    expect(PRICING.status).toBe('proposed');
    renderWithProviders(<PricingSection />);

    expect(screen.getByTestId('landing-pricing-proposed')).toHaveTextContent(
      'Nothing is charged today'
    );
  });

  it('hides the notice once the plans are approved', () => {
    renderWithProviders(<PricingSection pricing={{ ...PRICING, status: 'approved' }} />);

    expect(screen.queryByTestId('landing-pricing-proposed')).not.toBeInTheDocument();
    expect(screen.getByTestId('landing-price-business')).toHaveTextContent('₹349');
  });

  /** "2 months free" is a promise: yearly is exactly ten months, for every plan. */
  it('prices yearly at exactly ten times monthly, with no struck-through figure', () => {
    renderWithProviders(<PricingSection />);

    fireEvent.click(screen.getByRole('radio', { name: 'Yearly' }));

    expect(YEARLY_BILLED_MONTHS).toBe(10);
    PRICING.plans.forEach((plan) => {
      expect(priceFor(plan, 'yearly')).toBe(plan.monthly * 10);
      expect(screen.getByTestId(`landing-price-${plan.id}`)).toHaveTextContent(
        `₹${yearlyPrice(plan.monthly).toLocaleString('en-IN')}`
      );
    });
    expect(screen.getByTestId('landing-price-starter')).toHaveTextContent('₹1,490');
    expect(screen.getByTestId('landing-price-wholesale')).toHaveTextContent('₹6,990');
    expect(screen.getByText('2 months free')).toBeInTheDocument();
    expect(document.querySelector('s, del, .line-through')).toBeNull();
  });

  it('carries the four plans at the agreed monthly prices, excluding GST', () => {
    renderWithProviders(<PricingSection />);

    expect(PRICING.plans.map((plan) => [plan.id, plan.monthly])).toEqual([
      ['free', 0],
      ['starter', 149],
      ['business', 349],
      ['wholesale', 699],
    ]);
    expect(screen.getByText('Prices exclude GST.')).toBeInTheDocument();
    expect(screen.getByTestId('landing-plan-free')).toHaveTextContent('30 invoices a month');
    expect(screen.getByTestId('landing-plan-wholesale')).toHaveTextContent('Unlimited devices');
  });

  it('calls Business "good for growing shops", never "most popular"', () => {
    renderWithProviders(<PricingSection />);

    expect(screen.getByTestId('landing-plan-business')).toHaveTextContent(
      'Good for growing businesses'
    );
    expect(document.body.textContent).not.toMatch(/popular/i);
  });
});

describe('ThemeToggle', () => {
  /**
   * The toggle must write an EXPLICIT choice — the only kind `ub_theme_choice`
   * stores and the only kind the pre-paint script reads — or a visitor who
   * picked dark here gets light again on the next load.
   */
  it('writes the explicit choice to the cookie the pre-paint script reads', () => {
    act(() => {
      store.dispatch(themeRestored('light'));
    });
    document.cookie = `${THEME_CHOICE_COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    renderWithProviders(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );
    const toggle = screen.getByRole('button', { name: 'Dark mode' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(store.getState().theme).toEqual({ mode: 'dark', explicit: true });
    expect(document.cookie).toContain(`${THEME_CHOICE_COOKIE}=dark`);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('splitAroundWord', () => {
  it('splits the key line around the rotating word in either language', () => {
    expect(splitAroundWord('Track ⁣WORD⁣')).toEqual(['Track ', '']);
    expect(splitAroundWord('हिसाब रखें: ⁣WORD⁣')).toEqual(['हिसाब रखें: ', '']);
  });
});
