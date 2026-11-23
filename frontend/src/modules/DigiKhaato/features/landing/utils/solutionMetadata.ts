import { absoluteUrl } from 'src/utils/seo';

import { OG_IMAGE } from '../config/seoAssets';

import type { Metadata } from 'next';
/** The page's two languages, so each tells search engines about the other (hreflang). */
interface Languages {
  readonly locale: 'en_IN' | 'hi_IN';
  readonly english: string;
  readonly hindi: string;
}

export function solutionMetadata(
  path: string,
  title: string,
  description: string,
  languages?: Languages
): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: absoluteUrl(path),
      ...(languages
        ? {
            languages: {
              'en-IN': absoluteUrl(languages.english),
              'hi-IN': absoluteUrl(languages.hindi),
              'x-default': absoluteUrl(languages.english),
            },
          }
        : {}),
    },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      url: absoluteUrl(path),
      siteName: 'YourKhata',
      title,
      description,
      locale: languages?.locale ?? 'en_IN',
      images: [{ ...OG_IMAGE }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE.url] },
  };
}
