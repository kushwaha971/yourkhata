'use client';

import { MessageSquareText } from 'lucide-react';

import { useFeedback } from 'src/analytics/feedback';
import { UbButton } from 'src/design-system';
import { useTranslation } from 'src/hooks/useTranslation';

/**
 * Feedback, always in sight beside the bell (owner, 17 Nov 2026): a menu item
 * is found only by somebody already looking for it. It opens the same PostHog
 * survey the account menu does, and draws nothing when no survey is running,
 * because a button that opens nothing teaches people the product is broken.
 */
export function FeedbackButton(): React.JSX.Element | null {
  const { t } = useTranslation();
  const feedback = useFeedback();
  if (!feedback) return null;
  return (
    <UbButton
      variant="ghost"
      iconOnly
      icon={<MessageSquareText aria-hidden className="h-5 w-5" />}
      onClick={feedback}
      data-testid="feedback-button"
      className="shrink-0"
    >
      {t('feedback.tab.label')}
    </UbButton>
  );
}
