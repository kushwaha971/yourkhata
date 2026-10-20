'use client';
import { useEffect, useState } from 'react';

import { useAppSelector } from 'src/hooks/useAppStore';
import { selectRequestScopeKey } from 'src/redux/slice/sessionSlice';

import { getCounter, type CounterData } from '../api/counterService';

import type { ActivityItem } from '../types/reports.types';

export function useCounter(refreshKey: string, activities: readonly ActivityItem[] = []): { data: CounterData | null; failed: boolean } {
  const scope = useAppSelector(selectRequestScopeKey);
  const documents = [...new Set(activities
    .filter(({ source }) => ['sales_document', 'purchase_document'].includes(source.kind))
    .slice(0, 10).map(({ source }) => `${source.kind}:${source.id}`))].sort().join(',');
  const key = JSON.stringify([scope, refreshKey, documents]);
  const [result, setResult] = useState<{
    key: string;
    data: CounterData | null;
    failed: boolean;
  } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    getCounter(abort.signal, documents ? documents.split(',') : [])
      .then((data) => {
        if (!abort.signal.aborted) setResult({ key, data, failed: false });
      })
      .catch(() => {
        if (!abort.signal.aborted) setResult({ key, data: null, failed: true });
      });
    return () => abort.abort();
  }, [key, documents]);
  return result?.key === key ? result : { data: null, failed: false };
}
