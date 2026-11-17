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
    <UbButton
      variant="secondary"
      icon={icon}
      onClick={feedback}
      data-testid="feedback-button-floating"
      className={cn(
        'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 rounded-pill shadow-[0_8px_30px_-12px_rgb(10_9_11/0.35)]'
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
