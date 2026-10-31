import { API_PATHS } from 'src/api/APIPaths';
import { api, ubConfig } from 'src/api/AxiosInstances';
import { toQueryString } from 'src/utils/queryString';

/** D P1c — `/locations` and `/stock-transfers` (design D10 "Move stock"). */
export interface Place {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly isDefault: boolean;
}

export interface PlaceStock {
  readonly itemId: string;
  readonly name: string;
  readonly unitCode: string;
  readonly allowDecimal: boolean;
  readonly atFrom: string;
  readonly atTo: string;
}

interface PlaceWire {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly is_default: boolean;
}

const toPlace = (row: PlaceWire): Place => ({
  id: row.id,
  name: row.name,
  code: row.code,
  isDefault: row.is_default,
});

export const listPlaces = async (signal?: AbortSignal): Promise<readonly Place[]> => {
  const response = await api.get<{ data: readonly PlaceWire[] }>(
    API_PATHS.LOCATIONS,
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  return response.data.data.map(toPlace);
};

export const addPlace = async (name: string): Promise<Place> => {
  const response = await api.post<{ data: PlaceWire }>(API_PATHS.LOCATIONS, { name });
  return toPlace(response.data.data);
};

/** What each of the two places holds, for the items on the screen. */
export const placeStock = async (
  from: string,
  to: string,
  itemIds: readonly string[],
  signal?: AbortSignal
): Promise<readonly PlaceStock[]> => {
  if (itemIds.length === 0) return [];
  const response = await api.get<{
    data: readonly {
      item_id: string;
      name: string;
      unit_code: string;
      allow_decimal: boolean;
      at_from: string;
      at_to: string;
    }[];
  }>(
    `${API_PATHS.STOCK_TRANSFER_STOCK}${toQueryString({ from, to, ids: itemIds.join(','), page_size: 200 })}`,
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  return response.data.data.map((row) => ({
    itemId: row.item_id,
    name: row.name,
    unitCode: row.unit_code,
    allowDecimal: row.allow_decimal,
    atFrom: row.at_from,
    atTo: row.at_to,
  }));
};

export const postTransfer = async (
  body: {
    readonly from_location_id: string;
    readonly to_location_id: string;
    readonly lines: readonly { readonly item_id: string; readonly qty: string }[];
  },
  idempotencyKey: string
): Promise<{ readonly id: string; readonly number: string }> => {
  const response = await api.post<{ data: { id: string; number: string } }>(
    API_PATHS.STOCK_TRANSFERS,
    body,
    ubConfig({ headers: { 'Idempotency-Key': idempotencyKey } })
  );
  return response.data.data;
};
