import React, { useState } from 'react';
import { useClasses } from '../../Dashboard/hooks/use-classes';
import ClassFormModal from '../components/class-form-modal';
import type { TrainingClass } from '../../../shared/types/training-class-schema';

/**
 * GEMS: ClassManagementPage | P1 | ✓✓ | ()→JSX.Element | Story-1.3 | 班別管理頁面
 * GEMS-FLOW: LIST→CRUD→MODAL
 * GEMS-DEPS: [createClass, updateClass, deleteClass, ClassFormModal]
 * GEMS-DEPS-RISK: MEDIUM
 */

export default function ClassManagementPage() {
  const { classes, loading, error, refetch } = useClasses();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TrainingClass | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const handleEdit = (cls: TrainingClass) => {
    setEditTarget(cls);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditTarget(null);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/classes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refetch();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeleteConfirm(null);
    }
  };

  if (loading) return <div className="p-8 text-gray-500">載入中...</div>;
  if (error) return <div className="p-8 text-red-500">載入失敗：{error}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-gray-800">班別管理</h1>
          <p className="text-sm text-gray-500">共 {classes.length} 筆</p>
        </div>
        <button onClick={handleNew}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          + 新增班別
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="px-4 py-2 text-left">班別名稱</th>
                <th className="px-4 py-2 text-left">年度期別</th>
                <th className="px-4 py-2 text-left">開始日期</th>
                <th className="px-4 py-2 text-left">結束日期</th>
                <th className="px-4 py-2 text-left">教室</th>
                <th className="px-4 py-2 text-left">人數</th>
                <th className="px-4 py-2 text-left">狀態</th>
                <th className="px-4 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">尚無資料</td>
                </tr>
              ) : (
                classes.map((cls) => (
                  <tr key={cls.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{cls.className}</td>
                    <td className="px-4 py-2 text-gray-600">{cls.yearPeriod}</td>
                    <td className="px-4 py-2 text-gray-600">{cls.startDate}</td>
                    <td className="px-4 py-2 text-gray-600">{cls.endDate}</td>
                    <td className="px-4 py-2 text-gray-600">{cls.assignedRoom ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{cls.headcount}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                        cls.scheduleStatus === 'scheduled' ? 'bg-green-100 text-green-700' :
                        cls.scheduleStatus === 'adjusted' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {cls.scheduleStatus === 'scheduled' ? '已排定' : cls.scheduleStatus === 'adjusted' ? '已調整' : '待確認'}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(cls)}
                          className="text-xs text-blue-600 hover:underline">編輯</button>
                        {deleteConfirm === cls.id ? (
                          <>
                            <button onClick={() => handleDelete(cls.id)}
                              className="text-xs text-red-600 hover:underline">確認</button>
                            <button onClick={() => setDeleteConfirm(null)}
                              className="text-xs text-gray-400 hover:underline">取消</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirm(cls.id)}
                            className="text-xs text-red-400 hover:underline">刪除</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ClassFormModal
        open={modalOpen}
        editTarget={editTarget}
        onClose={() => setModalOpen(false)}
        onSaved={refetch}
      />
    </div>
  );
}
