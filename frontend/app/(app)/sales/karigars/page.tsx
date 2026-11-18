import { redirect } from 'next/navigation';

import { ROUTES } from 'src/routes';

/** The menu's Karigars row: their panel lives on Custom orders (design dJOrders). */
export default function KarigarsPage(): never {
  redirect(`${ROUTES.SALES_CUSTOM_ORDERS}?view=karigars`);
}
