import { API_PATHS } from 'src/api/APIPaths';
import { api, ubConfig } from 'src/api/AxiosInstances';
import { toQueryString } from 'src/utils/queryString';

/** G1 — a jeweller's rate per gram for one day (design §G1). */
export const PURITIES = ['gold_24k', 'gold_22k', 'gold_18k', 'silver'] as const;
export type Purity = (typeof PURITIES)[number];
export type RateFigures = Readonly<Record<Purity, string | null>>;

export interface DayRate {
  readonly day: string;
  readonly rates: RateFigures;
  readonly setBy: string;
  readonly setAt: string;
}

export interface TodayRates {
  readonly day: string;
  readonly today: DayRate | null;
  readonly yesterday: DayRate | null;
}

interface DayRateDto {
  day: string;
  rates: RateFigures;
  set_by: string;
  set_at: string;
}

const toDay = (row: DayRateDto | null): DayRate | null =>
  row ? { day: row.day, rates: row.rates, setBy: row.set_by, setAt: row.set_at } : null;

const toToday = (data: { day: string; today: DayRateDto | null; yesterday: DayRateDto | null }): TodayRates => ({
  day: data.day,
  today: toDay(data.today),
  yesterday: toDay(data.yesterday),
});

export const getTodayRates = async (signal?: AbortSignal): Promise<TodayRates> => {
  const response = await api.get<{ data: Parameters<typeof toToday>[0] }>(
    API_PATHS.METAL_RATES_TODAY,
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  return toToday(response.data.data);
};

/** Blank purities are sent as null: a metal the shop doesn't sell. */
export const saveTodayRates = async (rates: RateFigures): Promise<TodayRates> => {
  const response = await api.put<{ data: Parameters<typeof toToday>[0] }>(API_PATHS.METAL_RATES_TODAY, rates);
  return toToday(response.data.data);
};

export const getRateHistory = async (
  month: string,
  signal?: AbortSignal
): Promise<{ readonly month: string; readonly rows: readonly DayRate[] }> => {
  const response = await api.get<{ data: { month: string; rows: DayRateDto[] } }>(
    `${API_PATHS.METAL_RATES}${toQueryString({ month })}`,
    ubConfig({ signal, suppressErrorSnackbar: true })
  );
  return {
    month: response.data.data.month,
    rows: response.data.data.rows.map((row) => toDay(row) as DayRate),
  };
};
