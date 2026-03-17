import React from 'react';
import { useClasses } from '../hooks/use-classes';
import { detectConflicts } from '../lib/detect-conflicts';
import type { TrainingClass, ConflictFlag } from '../../../shared/types/training-class-schema';

/**
 * GEMS: DashboardPage | P1 | ✓✓ | ()→JSX.Element | Story-1.1 | Dashboard 總覽頁面
 * GEMS-FLOW: FETCH→RENDER→TABLE
 * GEMS-DEPS: [useClasses, detectConflicts]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] FETCH — 透過 useClasses 取得資料
// [STEP] RENDER — 顯示統計卡片 + 衝突警示
// [STEP] TABLE — 班別列表表格

function getUpcoming(classes: TrainingClass[], days = 14): TrainingClass[] {
  const now = new Date();
  const limit = new Date(now.getTime() + days * 86400000);
  return classes.filter((c) => {
    const start = new Date(c.startDate);
    return start >= now && start <= limit;
  });
}

export default function DashboardPage() {
  // [STEP] FETCH
  const { classes, loading, error, refetch } = useClasses();
  const conflicts: ConflictFlag[] = detectConflicts(classes);
  const upcoming = getUpcoming(classes);

  if (loading) {
    return <div className="p-8 text-gray-500">載入中...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-500 mb-2">載入失敗：{error}</p>
        <button onClick={refetch} className="text-sm text-blue-600 underline">重試</button>
      </div>
    );
  }

  // [STEP] RENDER
  return (
    <div className="p-6 space-y-6">
      {/* 統計卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="班別總數" value={classes.length} />
        <StatCard label="即將開班（14天內）" value={upcoming.length} accent="blue" />
        <StatCard label="教室衝突" value={conflicts.length} accent={conflicts.length > 0 ? 'red' : undefined} />
      </div>

      {/* 衝突警示 */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-700 mb-2">⚠ 教室衝突 ({conflicts.length})</h3>
          <ul className="space-y-1">
            {conflicts.map((c, i) => (
              <li key={i} className="text-sm text-red-600">{c.description}</li>
            ))}
          </ul>
        </div>
      )}

      {/* [STEP] TABLE */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">班別列表</h2>
          <button onClick={refetch} className="text-xs text-gray-400 hover:text-gray-600">重新整理</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-2 text-left">班別名稱</th>
                <th className="px-4 py-2 text-left">年度期別</th>
                <th className="px-4 py-2 text-left">開始日期</th>
                <th className="px-4 py-2 text-left">結束日期</th>
                <th className="px-4 py-2 text-left">天數</th>
                <th className="px-4 py-2 text-left">教室</th>
                <th className="px-4 py-2 text-left">人數</th>
                <th className="px-4 py-2 text-left">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">尚無資料</td>
                </tr>
              ) : (
                classes.map((cls) => {
                  const hasConflict = conflicts.some((c) => c.classId === cls.id || c.conflictWith === cls.id);
                  return (
                    <tr key={cls.id} className={hasConflict ? 'bg-red-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-2 font-medium text-gray-800">
                        {hasConflict && <span className="mr-1 text-red-500">⚠</span>}
                        {cls.className}
                      </td>
                      <td className="px-4 py-2 text-gray-600">{cls.yearPeriod}</td>
                      <td className="px-4 py-2 text-gray-600">{cls.startDate}</td>
                      <td className="px-4 py-2 text-gray-600">{cls.endDate}</td>
                      <td className="px-4 py-2 text-gray-600">{cls.trainingDays}</td>
                      <td className="px-4 py-2 text-gray-600">{cls.assignedRoom ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-600">{cls.headcount}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={cls.scheduleStatus} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: 'blue' | 'red' }) {
  const color = accent === 'red' ? 'text-red-600' : accent === 'blue' ? 'text-blue-600' : 'text-gray-800';
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    adjusted: 'bg-blue-100 text-blue-700',
  };
  const label: Record<string, string> = {
    scheduled: '已排定',
    pending: '待確認',
    adjusted: '已調整',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {label[status] ?? status}
    </span>
  );
}
