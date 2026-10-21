'use client';

import { useLayoutEffect, useRef } from 'react';

import { UbPageShell, type UbPageShellProps } from './UbPageShell';

/** Available-height registers reuse the page composition without making ordinary screens measure layout. */
export function UbViewportPageShell(
  props: Readonly<Omit<UbPageShellProps, 'viewport' | 'viewportRef'>>
): React.JSX.Element {
  const frame = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const update = () => {
      const visual = window.visualViewport;
      node.style.setProperty(
        '--ub-page-top',
        `${node.getBoundingClientRect().top + window.scrollY - (visual?.offsetTop ?? 0)}px`
      );
      node.style.setProperty('--ub-page-viewport', `${visual?.height ?? window.innerHeight}px`);
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    // Header/notices can change height without a window resize. No global shell mutation.
    const main = node.closest('main');
    for (const sibling of Array.from(main?.parentElement?.children ?? []))
      observer?.observe(sibling);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    if (main?.parentElement) observer?.observe(main.parentElement);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);
  return <UbPageShell {...props} viewport viewportRef={frame} />;
}
