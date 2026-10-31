import { API_PATHS } from 'src/api/APIPaths';
import { api, ubConfig } from 'src/api/AxiosInstances';

/** D12 — `GET /stock/home-strip`: only the tiles this business keeps. */
export type HomeStripKey = 'expiring' | 'phones' | 'soldOutSizes';

export interface HomeStripTile {
  readonly key: HomeStripKey;
  readonly count: number;
  /** Absent (not zero) without `reports.financial.read`. */
  readonly value: string | null;
}

export const getHomeStrip = async (signal?: AbortSignal): Promise<readonly HomeStripTile[]> => {
  const response = await api.get<{
    data: readonly { key: HomeStripKey; count: number; value?: string }[];
  }>(API_PATHS.STOCK_HOME_STRIP, ubConfig({ signal, suppressErrorSnackbar: true }));
  return response.data.data.map((tile) => ({
    key: tile.key,
    count: tile.count,
    value: tile.value ?? null,
  }));
};
