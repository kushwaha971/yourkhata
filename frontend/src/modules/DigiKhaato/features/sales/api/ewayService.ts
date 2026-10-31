import { API_PATHS } from 'src/api/APIPaths';
import { api, ubConfig } from 'src/api/AxiosInstances';

/** D P5 — `/sales/invoices/{id}/eway`: transport details and the portal file. */
export interface EwayTransport {
  readonly transporter: string;
  readonly vehicle_number: string;
  readonly distance_km: number;
  readonly mode: 'road' | 'rail' | 'air' | 'ship';
}

export interface EwayState {
  readonly offered: boolean;
  readonly transport: EwayTransport | null;
  readonly file: unknown;
}

export const getEway = async (id: string, signal?: AbortSignal): Promise<EwayState> =>
  (
    await api.get<{ data: EwayState }>(
      API_PATHS.SALES_INVOICE_EWAY(id),
      ubConfig({ signal, suppressErrorSnackbar: true })
    )
  ).data.data;

export const saveEway = async (id: string, body: EwayTransport): Promise<void> => {
  await api.post(API_PATHS.SALES_INVOICE_EWAY(id), body);
};
