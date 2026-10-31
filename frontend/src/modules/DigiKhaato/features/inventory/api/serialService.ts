import { API_PATHS } from 'src/api/APIPaths';
import { api, ubConfig } from 'src/api/AxiosInstances';

/** D P3 — `GET /serials/{code}`: find by IMEI (design D8). */
export interface SerialFound {
  readonly serial: string;
  readonly status: 'in_stock' | 'sold';
  readonly item: { readonly id: string; readonly name: string };
  readonly warrantyUntil: string | null;
  readonly sale: {
    readonly id: string;
    readonly number: string | null;
    readonly date: string;
    readonly customer: { readonly name: string; readonly mobile: string | null } | null;
  } | null;
  readonly purchase: {
    readonly id: string;
    readonly number: string | null;
    readonly date: string;
    readonly supplier: { readonly name: string; readonly mobile: string | null } | null;
  } | null;
}

interface SerialWire {
  readonly serial: string;
  readonly status: 'in_stock' | 'sold';
  readonly item: { readonly id: string; readonly name: string };
  readonly warranty_until: string | null;
  readonly sale: SerialFound['sale'];
  readonly purchase: SerialFound['purchase'];
}

export const findSerial = async (code: string): Promise<SerialFound> => {
  const response = await api.get<{ data: SerialWire }>(
    API_PATHS.SERIAL(code),
    ubConfig({ suppressErrorSnackbar: true })
  );
  const row = response.data.data;
  return {
    serial: row.serial,
    status: row.status,
    item: row.item,
    warrantyUntil: row.warranty_until,
    sale: row.sale,
    purchase: row.purchase,
  };
};
