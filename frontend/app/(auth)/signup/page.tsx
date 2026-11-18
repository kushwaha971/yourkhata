import { redirect } from 'next/navigation';

import { ROUTES } from 'src/routes';

/**
 * Owner, 12 Nov 2026: there is one sign-in-or-sign-up page. A mobile number
 * and a code are the whole of both — a new number becomes an account on its
 * first verified code — so `/signup` (still linked from the landing page and
 * from old messages) forwards to `/login`.
 */
export default function SignUpPage(): never {
  redirect(ROUTES.LOGIN);
}
