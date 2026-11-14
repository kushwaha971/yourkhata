import { API_PATHS } from 'src/api/APIPaths';
import { api, ubConfig } from 'src/api/AxiosInstances';
import { toQueryString } from 'src/utils/queryString';

/** G4 — `GET /reports/schedule-h`: a medical store's Schedule H register. */
export interface ScheduleHRow {
  readonly id: string;
  readonly date: string;
  readonly number: string | null;
  readonly customer: string | null;
  readonly medicines: readonly {
    readonly name: string;
    readonly schedule: string;
    readonly qty: string;
    readonly unitCode: string;
  }[];
  readonly doctor: string | null;
  readonly patient: string | null;
}

export const getScheduleH = async (
  dateFrom: string,
  dateTo: string,
  signal?: AbortSignal
): Promise<{
  readonly rows: readonly ScheduleHRow[];
  readonly counts: { readonly bills: number; readonly withoutDoctor: number };
}> => {
  const response = await api.get<{
    data: readonly {
      id: string;
      date: string;
      number: string | null;
      customer: string | null;
      medicines: readonly { name: string; schedule: string; qty: string; unit_code: string }[];
      doctor: string | null;
      patient: string | null;
    }[];
    meta: { counts: { bills: number; without_doctor: number } };
  }>(
    `${API_PATHS.REPORT_SCHEDULE_H}${toQueryString({ date_from: dateFrom, date_to: dateTo })}`,
    ubConfig({ signal })
  );
  const { data, meta } = response.data;
  return {
    rows: data.map((row) => ({
      id: row.id,
      date: row.date,
      number: row.number,
      customer: row.customer,
      medicines: row.medicines.map((m) => ({
        name: m.name,
        schedule: m.schedule,
        qty: m.qty,
        unitCode: m.unit_code,
      })),
      doctor: row.doctor || null,
      patient: row.patient || null,
    })),
    counts: { bills: meta.counts.bills, withoutDoctor: meta.counts.without_doctor },
  };
};
