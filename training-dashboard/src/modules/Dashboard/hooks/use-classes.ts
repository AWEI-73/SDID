import { useState, useEffect } from 'react';
import type { TrainingClass } from '../../../shared/types/training-class-schema';

/**
 * GEMS: useClasses | P1 | ✓✓ | ()→{classes, loading, error} | Story-1.1 | 取得班別列表 React Hook
 * GEMS-FLOW: FETCH→STATE→RETURN
 * GEMS-DEPS: [getClasses]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] FETCH — 呼叫 /api/classes
// [STEP] STATE — 管理 loading/error/data 狀態
// [STEP] RETURN — 回傳狀態物件

export interface UseClassesResult {
  classes: TrainingClass[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useClasses(): UseClassesResult {
  const [classes, setClasses] = useState<TrainingClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // [STEP] FETCH
    fetch('/api/classes')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<TrainingClass[]>;
      })
      .then((data) => {
        if (!cancelled) {
          // [STEP] STATE
          setClasses(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [tick]);

  // [STEP] RETURN
  return { classes, loading, error, refetch: () => setTick((t) => t + 1) };
}
