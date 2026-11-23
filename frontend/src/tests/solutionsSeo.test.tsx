import fs from 'node:fs';
import path from 'node:path';

import { screen } from '@testing-library/react';

import { isPublicPath } from 'src/routes';
import { renderWithProviders } from 'src/tests/renderWithProviders';

import { metadata as authMetadata } from 'app/(auth)/layout';

import { SolutionsPage } from 'modules/DigiKhaato/features/landing/components/SolutionsPage';
import { SOLUTIONS, solutionBySlug } from 'modules/DigiKhaato/features/landing/config/solutions';
import { solutionMetadata } from 'modules/DigiKhaato/features/landing/utils/solutionMetadata';

it('keeps marketing routes public while excluding sign-in from indexing', () => {
  expect(isPublicPath('/solutions/shop-billing')).toBe(true);
  expect(isPublicPath('/parties/private-person')).toBe(false);
  expect(authMetadata.robots).toMatchObject({ index: false, follow: false });
});
it.each(SOLUTIONS)('renders crawlable content and matching FAQs for $slug', (solution) => {
  const { container } = renderWithProviders(<SolutionsPage solution={solution} />);
  expect(screen.getByRole('heading', { level: 1, name: solution.name })).toBeInTheDocument();
  for (const link of screen.getAllByRole('link', { name: 'Start free' }))
    expect(link).toHaveAttribute('href', '/login');
  const json = JSON.parse(
    container.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}'
  );
  const faq = json['@graph'].find((node: Record<string, unknown>) => node['@type'] === 'FAQPage');
  expect(faq.mainEntity).toHaveLength(solution.questions.length);
  for (const { question, answer } of solution.questions) {
    expect(screen.getByText(question)).toBeInTheDocument();
    expect(screen.getByText(answer)).toBeInTheDocument();
  }
  expect(
    solutionMetadata(`/solutions/${solution.slug}`, solution.title, solution.description).alternates
      ?.canonical
  ).toBe(`https://yourkhata.com/solutions/${solution.slug}`);
});

/** The loans page (17 Nov 2026) claimed "lending reports" the app does not
 * have and gave no worked example; the home page claimed interest and a
 * printed statement. Every claim here must match the Ledger module as built. */
it('tells the loans story with a worked example, its limits and no feature the app lacks', () => {
  const lending = solutionBySlug('lending-collections');
  if (!lending) throw new Error('the loans page is missing');
  const { container } = renderWithProviders(<SolutionsPage solution={lending} />);
  expect(screen.getByRole('heading', { level: 2, name: 'In short' })).toBeInTheDocument();
  expect(screen.getByText(/To collect ₹22,000/)).toBeInTheDocument();
  expect(screen.getByText(/In hand ₹19,000/)).toBeInTheDocument();
  expect(screen.getByText(/Earns ₹3,000/)).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { level: 2, name: 'What Ledger does not do' })
  ).toBeInTheDocument();
  expect(screen.getAllByText('Illustrative').length).toBeGreaterThan(0);
  const text = container.textContent ?? '';
  expect(text).not.toMatch(/report|interest rate is|print/i);
  expect(text).not.toMatch(/sign up|create (an |your )?account/i);
});

describe('Guides on the Ledger and every shop kind page', () => {
  it('has a phone and a computer screenshot on disk for every guide, so no guide shows a broken image', () => {
    expect(solutionBySlug('lending-collections')?.guides?.length ?? 0).toBeGreaterThanOrEqual(7);
    // Every page with guides — the Ledger and each shop kind — ships both sizes of every shot.
    for (const s of SOLUTIONS)
      for (const g of s.guides ?? [])
        for (const size of ['phone', 'desktop'])
          for (const ext of ['webp', 'jpg'])
            expect([
              s.slug,
              fs.existsSync(
                path.join(
                  process.cwd(),
                  'public/media/guides',
                  s.media ?? s.slug,
                  `${size}-${g.shot}.${ext}`
                )
              ),
            ]).toEqual([s.slug, true]);
  });
});

describe('the guides hub', () => {
  it('lets a visitor choose any of the fourteen businesses, each leading to its own guide page', () => {
    const { container } = renderWithProviders(<SolutionsPage />);
    const tiles = [...container.querySelectorAll<HTMLAnchorElement>('#business a[data-business]')];
    expect(tiles).toHaveLength(14);
    tiles.forEach((tile) => {
      const slug = tile.getAttribute('href')?.replace('/solutions/', '') ?? '';
      expect(solutionBySlug(slug)).toBeDefined();
    });
  });
});
