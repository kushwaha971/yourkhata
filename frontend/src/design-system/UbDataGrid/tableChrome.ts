/**
 * The table's class strings, in one file, because two components now paint the
 * same table.
 *
 * `UbDataGridTable` paints it with rows in it. `UbDataGridStateTable` paints the
 * SAME table while the rows are still being fetched, and when there are none —
 * and the only reason that is worth doing (see that file) is that the two are
 * pixel-identical. A skeleton whose columns are 4 px narrower than the real
 * ones is a layout shift wearing a disguise, and it is exactly the kind of
 * difference that appears six months after someone edits one `px-3` and not the
 * other.
 *
 * So the strings live here and neither component owns them. The guard in
 * `UbDataGrid.test.tsx` asserts both files reference these constants rather than
 * spelling the classes out again.
 */

/** Numbers right, everything else left. Part 23 §23.2.6. */
export const ALIGN = { start: 'text-left', end: 'text-right' } as const;

export const GRID_SCROLLER = 'w-full min-w-0';

export const GRID_TABLE = 'w-full border-collapse';

/**
 * BrandHub's `TableHeader` is `bg-[#fafafa]` with a hairline under it, and the
 * tint is what actually separates the head from the body — a header the same
 * colour as the rows relies entirely on font weight, which at 13 px is not
 * much. `surface-sunken` is this product's token for the same near-white.
 */
export const GRID_THEAD = 'sticky top-0 z-10 bg-surface-subtle';

export const GRID_HEAD_ROW = 'border-b border-border-hairline';

export const GRID_TH =
  'ds-body-s-medium h-12 select-none whitespace-nowrap px-3 py-0 align-middle text-text-primary';

/** The checkbox column: fixed at 48 px so the name column starts in one place. */
export const GRID_SELECT_CELL = 'w-12 px-3 py-2';

/**
 * BrandHub's row is 52 px, set as an inline height on the `<tr>` so a grid can
 * override it per screen; ours was `h-14` (56) as a documented "comfortable
 * touch row". The owner asked for parity, and parity is right here: the table
 * tiers start at 768 px, so this row is never the one a thumb hits — the phone
 * gets cards, where the tap target is the whole card.
 *
 * The height itself is `UbDataGridTable`'s `rowHeight` prop now (default 52);
 * what stays in the class is everything that is not the height.
 *
 * Row hover IS still a departure and is kept: BrandHub has neither hover nor
 * striping, and hover is how a mouse keeps its place across a wide table.
 */
export const GRID_ROW = 'border-b border-border-hairline transition-colors last:border-b-0';

/** BrandHub's `rowHeight` default. */
export const GRID_ROW_HEIGHT = 52;

export const GRID_TD = 'ds-body-base-regular truncate px-3 py-2 align-middle text-text-primary';

/**
 * A7 — the Shop's registers draw the design's `.tf` table: a 46 px header row
 * of 13 px / 600 words in the secondary ink, 14 px side padding, and cells of
 * 10 px 14 px. Whole strings rather than overrides of the two above, so no
 * class has to win a fight over a font size it shares with the panel tables.
 */
export const REGISTER_TH =
  'h-[46px] select-none whitespace-nowrap px-[14px] py-0 align-middle text-[13px] font-semibold leading-tight text-text-secondary';

/** The sort button fills the header cell's height, not 48 px of its own. */
export const REGISTER_TH_BUTTON_HEIGHT = 'h-[46px]';

export const REGISTER_TD = 'ds-body-base-regular truncate px-[14px] py-[10px] align-middle text-text-primary';

/**
 * The one frame around a register's rows AND its pager (A7 ¶1–2): rounded,
 * one hairline, children clipped so the grey header follows the corners.
 * `clip`, not `hidden`, so it never becomes a scroll container and the sticky
 * header still sticks. The pager keeps its own top line, and the last row has
 * none, so exactly one line separates them.
 */
export const REGISTER_FRAME = 'rounded-card border border-border-hairline bg-surface-card overflow-clip';
