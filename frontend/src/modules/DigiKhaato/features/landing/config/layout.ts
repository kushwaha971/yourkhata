/** Layout class strings shared by the home page and the server-rendered guide pages.
 * Kept out of the `'use client'` primitives: a server component importing a
 * constant from a client module receives a client reference, not the string. */

/**
 * The landing page's own layout vocabulary — three pieces every section uses,
 * kept in one file so the rhythm (container, heading, eyebrow) is decided once.
 *
 * The container is `max-w-content` (1440) with the product's gutters. On 2K
 * and 4K screens the whole page is scaled instead (`LANDING_SCALE`, on the
 * page root), so type, spacing, frames and the container grow TOGETHER and a
 * 3840 screen does not show a small island in a sea of canvas.
 */
export const LANDING_CONTAINER = 'mx-auto w-full max-w-content px-4 sm:px-6 lg:px-8';

/**
 * CSS `zoom` at the very wide end: 1.25 from 2400 px (a 2560 monitor lays out
 * like 2048), 1.6 from 3400 px (a 3840 one like 2400). One knob rather than
 * a `min-[2400px]:` bump on every size, which is how the first cut ended up
 * with a 4K hero at 1440-px proportions.
 */
export const LANDING_SCALE = 'min-[2400px]:[zoom:1.25] min-[3400px]:[zoom:1.6]';
