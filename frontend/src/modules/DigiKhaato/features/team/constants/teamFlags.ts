/**
 * Everyone signs in with a mobile number and a code; nobody using the app has
 * an email or a password (owner, 15 Nov 2026). Inviting by email is therefore
 * off the Team screen. The flow stays in the code, untouched, because it is
 * the email flow the day email lands (DEC-012); turning this on brings it back.
 * An object rather than a constant so the invitation tests can turn it on.
 */
export const TEAM_FLAGS: { emailInvites: boolean } = { emailInvites: false };
