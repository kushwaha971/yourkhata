import { API_PATHS } from 'src/api/APIPaths';
import { api } from 'src/api/AxiosInstances';
import type { TWriteClass } from 'src/types/api.types';

import type { OtpChallenge } from 'modules/DigiKhaato/features/auth/types/auth.types';

/**
 * Your profile › Change mobile (design settings-and-profile S2). Lives with
 * Settings, not with the sign-in service every route ships: only this screen
 * sends these requests.
 */

/** POST /auth/me/mobile — a code on WhatsApp to the NEW number. */
export const requestMobileChange = async (mobile: string): Promise<OtpChallenge> => {
  const response = await api.post<{
    data: {
      challenge_id: string;
      expires_in: number;
      retry_after: number;
      code_length?: number;
      channel?: string;
    };
  }>(API_PATHS.AUTH_ME_MOBILE, { mobile });
  const data = response.data.data;
  return {
    challengeId: data.challenge_id,
    expiresIn: data.expires_in,
    retryAfter: data.retry_after,
    codeLength: typeof data.code_length === 'number' && data.code_length > 0 ? data.code_length : 6,
    channel: data.channel === 'whatsapp' ? 'whatsapp' : 'sms',
  };
};
export const requestMobileChangeWriteClass: TWriteClass = 'online-only';

/** POST /auth/me/mobile/confirm — the code proves the number; the sign-in moves. */
export const confirmMobileChange = async (input: {
  readonly challengeId: string;
  readonly code: string;
}): Promise<void> => {
  await api.post(API_PATHS.AUTH_ME_MOBILE_CONFIRM, {
    challenge_id: input.challengeId,
    code: input.code,
  });
};
export const confirmMobileChangeWriteClass: TWriteClass = 'online-only';
