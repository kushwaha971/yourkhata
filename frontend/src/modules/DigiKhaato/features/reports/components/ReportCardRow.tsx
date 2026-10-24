'use client';

import { ChevronRight } from 'lucide-react';

import { UbPressable, UbStack, UbText } from 'src/design-system';
import { formatInrUnbroken } from 'src/utils/moneyUnbroken';

/** One card's three things (09 §10.0). */
export interface ReportCard {
  /** WHO or WHAT: the contact, the item. Wraps in full: a word cut by an
   *  ellipsis is not a word (a 59-letter cable name lost its size). */
  readonly what: string;
  /** WHICH: the time, the type word, the number — each kept whole on a line. */
  readonly which: readonly {
    readonly text: string;
    readonly testId?: string;
    readonly tone?: 'error';
    /** Prose rather than a number or a word: may wrap instead of staying whole. */
    readonly wrap?: boolean;
  }[];
  /** The one amount and the word that says what it is ("In", "On credit", "Total"). */
  readonly amount: {
    readonly word: string;
    readonly value: string | null;
    /** Shown instead of `value` as money — a count of documents, say. */
    readonly display?: string;
    readonly tone: 'success' | 'error' | 'primary';
    /** A second, smaller figure under it ("GST ₹1,234.00"). */
    readonly note?: string;
  } | null;
  /** A cancelled line: its amount struck through. */
  readonly struck: boolean;
  /** The card's accessible name (when it opens something). */
  readonly label: string;
}

/**
 * A report card's row: what, which and the one amount, with a chevron when a
 * tap opens something. Without `onOpen` it is a plain row — a GST section line
 * that has nothing behind it is not dressed as a button.
 */
export function ReportCardRow({
  view,
  onOpen,
  testId,
}: Readonly<{ view: ReportCard; onOpen?: () => void; testId: string }>): React.JSX.Element {
  const body = (
    <UbStack direction="row" align="start" justify="between" className="gap-3 py-2">
      <UbStack gap={0} className="min-w-0 flex-1 text-left">
        <UbText as="span" variant="body-sm-medium" className="break-words">
          {view.what}
        </UbText>
        {/* Each piece stays whole: at 320 px "INV/26-27/10028" split after
            "INV/26-" and read as two numbers. */}
        {view.which.length > 0 && (
          <UbText
            as="span"
            variant="caption"
            tone="tertiary"
            className="ds-num flex flex-wrap gap-x-1"
          >
            {view.which.map((piece, at) => (
              <UbText
                as="span"
                variant="inherit"
                key={`${at}-${piece.text}`}
                tone={piece.tone}
                className={piece.wrap ? undefined : 'whitespace-nowrap'}
                data-testid={piece.testId}
              >
                {at > 0 && !piece.testId ? `· ${piece.text}` : piece.text}
              </UbText>
            ))}
          </UbText>
        )}
      </UbStack>
      {(view.amount?.value || view.amount?.display) && (
        <UbStack gap={0} align="end" className="shrink-0">
          <UbText as="span" variant="caption" tone="secondary">
            {view.amount.word}
          </UbText>
          <UbText
            as="span"
            variant="body-sm-medium"
            tone={view.struck ? 'tertiary' : view.amount.tone}
            className={
              view.struck ? 'ds-num whitespace-nowrap line-through' : 'ds-num whitespace-nowrap'
            }
          >
            {view.amount.display ?? formatInrUnbroken(view.amount.value)}
          </UbText>
          {view.amount.note && (
            <UbText
              as="span"
              variant="caption"
              tone="tertiary"
              className="ds-num whitespace-nowrap"
            >
              {view.amount.note}
            </UbText>
          )}
        </UbStack>
      )}
      {onOpen && (
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
      )}
    </UbStack>
  );
  if (!onOpen)
    return (
      <UbStack gap={0} className="min-h-11" data-testid={testId}>
        {body}
      </UbStack>
    );
  return (
    <UbPressable
      onClick={onOpen}
      aria-label={view.label}
      className="-mx-2 min-h-11 rounded-md px-2 hover:bg-surface-hover"
      data-testid={testId}
    >
      {body}
    </UbPressable>
  );
}
