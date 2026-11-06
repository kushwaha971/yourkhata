import { act, render, screen } from '@testing-library/react';

import { OnboardingStepActions, STEP_ACTIONS_ARM_MS } from './OnboardingStepActions';

/**
 * E1 — a fast double or triple tap on step 1's Continue carried on through the
 * next steps' Continue, which sits in the same place, and landed on step 4 with
 * GST and address never seen. A step's buttons wait a moment after it opens.
 */
describe('OnboardingStepActions — a new step ignores taps for a moment', () => {
  it('keeps Continue and Skip off until the arm time has passed', () => {
    jest.useFakeTimers();
    render(
      <OnboardingStepActions
        onBack={null}
        onSkip={() => undefined}
        continueLabel="Continue"
        busyLabel="Saving"
        backLabel="Back"
        skipLabel="Skip"
        busy={false}
        disabled={false}
        armMs={STEP_ACTIONS_ARM_MS}
      />
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeDisabled();
    act(() => {
      jest.advanceTimersByTime(STEP_ACTIONS_ARM_MS);
    });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeEnabled();
    jest.useRealTimers();
  });
});
