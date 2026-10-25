import { API_PATHS } from 'src/api/APIPaths';
import { api, ubConfig } from 'src/api/AxiosInstances';

import type {
  ShopPromise,
  ShopPromiseRole,
  ShopPromiseValues,
} from '../types/shopPromise.types';

/**
 * BP-16 — Shop promises. One function per endpoint, owning the snake_case ⇄
 * camelCase mapping. Every write carries the caller's idempotency key, minted
 * once per logical save, so a retry after a timeout records one promise.
 */

interface ShopPromiseWire {
  readonly id: string;
  readonly party: { readonly id: string; readonly name: string; readonly mobile?: string | null };
  readonly role: ShopPromiseRole;
  readonly promised_on: string;
  readonly amount: string | null;
  readonly note: string;
  readonly state: ShopPromise['state'];
  readonly days_late: number | null;
  readonly version: number;
  readonly created_at: string;
  readonly created_by: string | null;
  readonly closed_at: string | null;
  readonly closed_by: string | null;
  readonly balance?: string;
  readonly days_overdue?: number | null;
}

const toPromise = (wire: ShopPromiseWire): ShopPromise => ({
  id: wire.id,
  party: wire.party,
  role: wire.role,
  promisedOn: wire.promised_on,
  amount: wire.amount,
  note: wire.note,
  state: wire.state,
  daysLate: wire.days_late,
  version: wire.version,
  createdAt: wire.created_at,
  createdBy: wire.created_by,
  closedAt: wire.closed_at,
  closedBy: wire.closed_by,
  ...(wire.balance === undefined ? {} : { balance: wire.balance }),
  ...(wire.days_overdue === undefined ? {} : { daysOverdue: wire.days_overdue }),
});

const keyed = (idempotencyKey: string) => ubConfig({ headers: { 'Idempotency-Key': idempotencyKey } });
/* The form's resolver turns a blank amount into null, so either spelling of
   "no figure promised" goes on the wire as null. */
const body = (values: ShopPromiseValues) => {
  const amount = (values.amount ?? '').trim();
  return { promised_on: values.promisedOn, amount: amount || null, note: (values.note ?? '').trim() };
};

/** The contact's open promise in this role (first, if any), then the closed ones. */
export const listPartyPromises = async (
  partyId: string,
  role: ShopPromiseRole,
  signal?: AbortSignal
): Promise<readonly ShopPromise[]> => {
  const response = await api.get<{ data: ShopPromiseWire[] }>(
    API_PATHS.PARTY_SHOP_PROMISES(partyId),
    ubConfig({ params: { role }, signal, suppressErrorSnackbar: true })
  );
  return response.data.data.map(toPromise);
};

export const createPromise = async (
  partyId: string,
  role: ShopPromiseRole,
  values: ShopPromiseValues,
  idempotencyKey: string
): Promise<ShopPromise> => {
  const response = await api.post<{ data: ShopPromiseWire }>(
    API_PATHS.PARTY_SHOP_PROMISES(partyId),
    { role, ...body(values) },
    keyed(idempotencyKey)
  );
  return toPromise(response.data.data);
};

/** Change the date, amount or note; refused (`stale_version`) if `version` is old. */
export const changePromise = async (
  promise: Pick<ShopPromise, 'id' | 'version'>,
  values: ShopPromiseValues,
  idempotencyKey: string
): Promise<ShopPromise> => {
  const response = await api.patch<{ data: ShopPromiseWire }>(
    `${API_PATHS.SHOP_PROMISES}/${promise.id}`,
    { version: promise.version, ...body(values) },
    keyed(idempotencyKey)
  );
  return toPromise(response.data.data);
};

export const closePromise = async (
  promise: Pick<ShopPromise, 'id' | 'version'>,
  how: 'kept' | 'cancel',
  idempotencyKey: string
): Promise<ShopPromise> => {
  const response = await api.post<{ data: ShopPromiseWire }>(
    `${API_PATHS.SHOP_PROMISES}/${promise.id}/${how}`,
    { version: promise.version },
    keyed(idempotencyKey)
  );
  return toPromise(response.data.data);
};

/** Home's Follow-ups: open promises due within a week, most urgent first. */
export const listOpenPromises = async (signal?: AbortSignal): Promise<readonly ShopPromise[]> => {
  const response = await api.get<{ data: ShopPromiseWire[] }>(
    API_PATHS.SHOP_PROMISES,
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  return response.data.data.map(toPromise);
};
