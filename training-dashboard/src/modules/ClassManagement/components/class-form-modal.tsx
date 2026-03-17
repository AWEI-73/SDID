import React, { useState, useEffect } from 'react';
import type { TrainingClass, CreateTrainingClassInput } from '../../../shared/types/training-class-schema';

/**
 * GEMS: ClassFormModal | P1 | ✓✓ | (props)→JSX.Element | Story-1.3 | 班別新增/編輯表單 Modal
 * GEMS-FLOW: OPEN→FORM→SUBMIT→CLOSE
 * GEMS-DEPS: [createClass, updateClass]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] OPEN — 接收 open 狀態與初始資料
// [STEP] FORM — 表單欄位綁定
// [STEP] SUBMIT — 呼叫 API 送出
// [STEP] CLOSE — 關閉並通知父元件

interface Props {
  open: boolean;
  editTarget?: TrainingClass | null;
  onClose: () => void;
  onSaved: () => void;
}

type FormData = Omit<CreateTrainingClassInput, 'useComputerRoom'> & { useComputerRoom: boolean };

const EMPTY: FormData = {
  yearPeriod: '', classCode: '', className: '', competencyType: '',
  trainingCategory: '', trainingSubCategory: '', deliveryMode: '實體',
  startDate: '', endDate: '', trainingDays: 0, weekNumber: 0,
  noticeDate: null, registrationDeadline: null, headcount: 0,
  organizer: '', venue: '', useComputerRoom: false, assignedRoom: null,
  coordinator: null, sortOrder: null, scheduleStatus: 'pending',
  adjustReason: null, notes: null,
};

export default function ClassFormModal({ open, editTarget, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // [STEP] OPEN
  useEffect(() => {
    if (open) {
      setForm(editTarget ? { ...EMPTY, ...editTarget } : EMPTY);
      setError('');
    }
  }, [open, editTarget]);

  if (!open) return null;

  const set = (key: keyof FormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // [STEP] SUBMIT
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const url = editTarget ? `/api/classes/${editTarget.id}` : '/api/classes';
      const method = editTarget ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }
      onSaved();
      // [STEP] CLOSE
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-medium text-gray-800">
            {editTarget ? '編輯班別' : '新增班別'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* [STEP] FORM */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="班別名稱 *" required>
              <input value={form.className} onChange={(e) => set('className', e.target.value)}
                className="input" required />
            </Field>
            <Field label="年度期別">
              <input value={form.yearPeriod} onChange={(e) => set('yearPeriod', e.target.value)}
                className="input" placeholder="115-1" />
            </Field>
            <Field label="開始日期 *" required>
              <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)}
                className="input" required />
            </Field>
            <Field label="結束日期 *" required>
              <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)}
                className="input" required />
            </Field>
            <Field label="訓練天數">
              <input type="number" value={form.trainingDays} onChange={(e) => set('trainingDays', parseInt(e.target.value) || 0)}
                className="input" min={0} />
            </Field>
            <Field label="人數">
              <input type="number" value={form.headcount} onChange={(e) => set('headcount', parseInt(e.target.value) || 0)}
                className="input" min={0} />
            </Field>
            <Field label="訓練地點">
              <input value={form.venue} onChange={(e) => set('venue', e.target.value)} className="input" />
            </Field>
            <Field label="指定教室">
              <input value={form.assignedRoom ?? ''} onChange={(e) => set('assignedRoom', e.target.value || null)}
                className="input" />
            </Field>
            <Field label="主辦單位">
              <input value={form.organizer} onChange={(e) => set('organizer', e.target.value)} className="input" />
            </Field>
            <Field label="教輔員">
              <input value={form.coordinator ?? ''} onChange={(e) => set('coordinator', e.target.value || null)}
                className="input" />
            </Field>
            <Field label="授課方式">
              <select value={form.deliveryMode} onChange={(e) => set('deliveryMode', e.target.value)} className="input">
                <option>實體</option>
                <option>線上</option>
                <option>混成</option>
              </select>
            </Field>
            <Field label="狀態">
              <select value={form.scheduleStatus} onChange={(e) => set('scheduleStatus', e.target.value as TrainingClass['scheduleStatus'])} className="input">
                <option value="pending">待確認</option>
                <option value="scheduled">已排定</option>
                <option value="adjusted">已調整</option>
              </select>
            </Field>
          </div>

          <Field label="備註">
            <textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)}
              className="input h-20 resize-none" />
          </Field>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.useComputerRoom}
              onChange={(e) => set('useComputerRoom', e.target.checked)} />
            使用電腦教室
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              取消
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {loading ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>

      <style>{`.input { width: 100%; border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px 10px; font-size: 14px; outline: none; } .input:focus { border-color: #3b82f6; }`}</style>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}{required && ' *'}</label>
      {children}
    </div>
  );
}
