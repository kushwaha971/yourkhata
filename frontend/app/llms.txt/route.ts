import { absoluteUrl } from 'src/utils/seo';

import en from 'locales/catalogues/landing.en.json';

import { faqAnswerKey, faqIds, faqQuestionKey } from 'modules/DigiKhaato/features/landing/config/faq';
import { ALL_MODULES_VISIBLE } from 'modules/DigiKhaato/features/landing/config/modules';
import { SHOW_PRICING } from 'modules/DigiKhaato/features/landing/config/pricing';
import { LANDING_DESCRIPTION, LANDING_TITLE } from 'modules/DigiKhaato/features/landing/config/seo';
import { SOLUTIONS } from 'modules/DigiKhaato/features/landing/config/solutions';

/**
 * `/llms.txt` (owner, 17 Nov 2026: GEO): the site in plain words for AI answer
 * engines, built from the same config the pages render, so it cannot claim
 * anything the pages do not. The format is llmstxt.org's: a title, a summary,
 * then linked sections.
 */
export const dynamic = 'force-static';

const words = en as Record<string, string>;

export function GET(): Response {
  const pages = SOLUTIONS.map(
    (s) => `- [${s.name}](${absoluteUrl(`/solutions/${s.slug}`)}): ${s.summary ?? s.description}`
  );
  const faq = faqIds(SHOW_PRICING).flatMap((id) => {
    const q = words[faqQuestionKey(id)];
    const a = words[faqAnswerKey(id, ALL_MODULES_VISIBLE)] ?? words[faqAnswerKey(id)];
    return q && a ? [`### ${q}`, a, ''] : [];
  });
  const body = [
    `# ${LANDING_TITLE}`,
    '',
    `> ${LANDING_DESCRIPTION}`,
    '',
    `YourKhata is a business app for India: GST bills, stock, purchases, payments and who owes you, on a phone or a computer. Sign in with a mobile number and a code sent on WhatsApp. Home: ${absoluteUrl('/')}`,
    '',
    '## Guides by business',
    '',
    ...pages,
    '',
    '## Questions people ask',
    '',
    ...faq,
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
