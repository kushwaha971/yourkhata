import { notFound } from 'next/navigation';

import { SolutionsPage } from 'modules/DigiKhaato/features/landing/components/SolutionsPage';
import {
  HINDI_SLUGS,
  hindiSolutionBySlug,
} from 'modules/DigiKhaato/features/landing/config/solutions.hi';
import { solutionMetadata } from 'modules/DigiKhaato/features/landing/utils/solutionMetadata';

import type { Metadata } from 'next';

/** The Hindi guide pages (owner, 22 Nov 2026): one per English guide, same pictures. */
type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export const generateStaticParams = (): { slug: string }[] => HINDI_SLUGS.map((slug) => ({ slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const solution = hindiSolutionBySlug(slug);
  if (!solution) notFound();
  return solutionMetadata(`/hi/solutions/${slug}`, solution.title, solution.description, {
    locale: 'hi_IN',
    english: `/solutions/${slug}`,
    hindi: `/hi/solutions/${slug}`,
  });
}

export default async function Page({ params }: Props): Promise<React.JSX.Element> {
  const { slug } = await params;
  const solution = hindiSolutionBySlug(slug);
  if (!solution) notFound();
  return <SolutionsPage solution={solution} lang="hi" />;
}
