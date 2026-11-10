import { api, ubConfig } from 'src/api/AxiosInstances';

/** G8 — vehicle history (design `dVehicle`), read from the bills themselves. */
export interface VehicleRow {
  readonly number: string;
  readonly model: string | null;
  readonly owner: string | null;
  readonly mechanic: string | null;
  readonly bills: number;
  readonly spent: string;
  readonly last_bill: string;
}

export interface VehicleBill {
  readonly id: string;
  readonly number: string;
  readonly date: string;
  readonly parts: string;
  readonly mechanic: string | null;
  readonly total: string;
}

export interface VehicleDetail {
  readonly number: string;
  readonly model: string | null;
  readonly owner: string | null;
  readonly owner_id: string | null;
  readonly mechanic: string | null;
  readonly garage: { readonly id: string; readonly name: string; readonly due: string } | null;
  readonly bills: number;
  readonly spent: string;
  readonly since: string;
  readonly bill_rows: readonly VehicleBill[];
}

/** G8 — a part that fits (design `pVehicle`): the item list's own row, narrowed. */
export interface FitPart {
  readonly id: string;
  readonly name: string;
  readonly sku: string | null;
  readonly rack: string | null;
  readonly part_numbers: readonly string[];
  readonly selling_price: string;
  readonly on_hand: string | null;
  readonly stock_status: 'ok' | 'low' | 'out' | null;
  readonly track_stock: boolean;
  readonly unit: { readonly code: string };
  readonly category: { readonly id: string; readonly name: string } | null;
}

export const listVehicles = async (q: string, signal?: AbortSignal): Promise<readonly VehicleRow[]> =>
  (await api.get<{ data: { vehicles: VehicleRow[] } }>('/sales/vehicles', ubConfig({ signal, params: { q } }))).data.data
    .vehicles;

export const getVehicle = async (number: string, signal?: AbortSignal): Promise<VehicleDetail> =>
  (
    await api.get<{ data: VehicleDetail }>(
      `/sales/vehicles/${encodeURIComponent(number)}`,
      ubConfig({ signal, suppressErrorSnackbar: true })
    )
  ).data.data;

export const listFittingParts = async (
  params: { readonly fits: string; readonly q?: string },
  signal?: AbortSignal
): Promise<readonly FitPart[]> =>
  (
    await api.get<{ data: FitPart[] }>(
      '/items',
      ubConfig({ signal, params: { ...params, page_size: 100, ordering: 'name' } })
    )
  ).data.data;
