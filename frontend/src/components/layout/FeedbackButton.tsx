'use client';

import { MessageSquareText } from 'lucide-react';

import { useFeedback } from 'src/analytics/feedback';
import { UbButton } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';
import { cn } from 'src/utils/cn';

/**
 * Feedback, always in sight (owner, 17 Nov 2026): a menu item is found only
 * by somebody already looking for it. It opens the same PostHog survey the
 * account menu does, and draws nothing when no survey is running, because a
 * button that opens nothing teaches people the product is broken.
 *
 * In the app it is an icon beside the bell. On the public pages (`floating`)
 * it is a labelled pill in the bottom corner, for the visitor who did not
 * follow a guide or could not sign in and has no header bell to look beside.
 */
export function FeedbackButton({
  floating = false,
}: Readonly<{ floating?: boolean }>): React.JSX.Element | null {
  const { t } = useTranslation();
  const feedback = useFeedback();
  if (!feedback) return null;
  const icon = <MessageSquareText aria-hidden className="h-5 w-5" />;
  return floating ? (
    // PostHog's own tab shape (owner, 17 Nov 2026): a vertical tab in the brand
    // colour, centred on the right edge, where a thumb finds it on a phone and
    // it never covers a page's own buttons in the bottom corner.
    <UbButton
      variant="primary"
      onClick={feedback}
      data-testid="feedback-button-floating"
      data-print="hide"
      className={cn(
        // Vertical text, read bottom to top, without rotating the box: a 44 px
        // wide target whose height follows the words in any language. rotate-180
        // puts the rounded side (`rounded-r` before the turn) facing the page.
        'fixed right-0 top-1/2 z-40 h-auto min-h-0 w-11 -translate-y-1/2 rounded-l-none rounded-r-[10px] px-0 py-4 [writing-mode:vertical-rl] rotate-180',
        'bg-action text-text-inverse shadow-[0_8px_30px_-12px_rgb(10_9_11/0.35)] hover:brightness-95'
      )}
    >
      {t('feedback.tab.label')}
    </UbButton>
  ) : (
    <UbButton
      variant="ghost"
      iconOnly
      icon={icon}
      onClick={feedback}
      data-testid="feedback-button"
      className="shrink-0"
    >
      {t('feedback.tab.label')}
    </UbButton>
  );
}
