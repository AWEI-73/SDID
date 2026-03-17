import React, { useState, useEffect } from 'react';
import type { ClassNode } from '../../../shared/types/class-node-schema';
import type { TrainingClass } from '../../../shared/types/training-class-schema';
import { calcNodeDate } from '../lib/calc-node-date';

/**
 * GEMS: NodeManagementPage | P1 | ✓✓ | ()→JSX.Element | Story-2.1 | 節點管控頁面
 * GEMS-FLOW: FETCH→RENDER→CRUD
 * GEMS-DEPS: [getNodesByClass, createNode, updateNode, deleteNode, generateIcs]
 * GEMS-DEPS-RISK: HIGH
 */
// [STEP] FETCH — 取得班別列表與節點
// [STEP] RENDER — 顯示節點列表與表單
// [STEP] CRUD — 新增/刪除節點操作

interface NodeWithDate extends ClassNode {
  dueDate: string;
  daysUntil: number;
}

interface Template {
  id: number;
  name: string;
  description: string | null;
  isDefault: boolean;
}

export default function NodeManagementPage() {
  const [classes, setClasses] = useState<TrainingClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [nodes, setNodes] = useState<NodeWithDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // Form state
  const [nodeName, setNodeName] = useState('');
  const [offsetDays, setOffsetDays] = useState(-7);
  const [nodeNotes, setNodeNotes] = useState('');

  // [STEP] FETCH — 取得班別列表
  useEffect(() => {
    fetch('/api/classes')
      .then(r => r.json())
      .then(setClasses)
      .catch(() => setError('載入班別失敗'));
    fetch('/api/templates')
      .then(r => r.json())
      .then(setTemplates)
      .catch(() => {});
  }, []);

  const selectedClass = classes.find(c => c.id === selectedClassId);

  const loadNodes = async (classId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/classes/${classId}/nodes`);
      const data: ClassNode[] = await res.json();
      const cls = classes.find(c => c.id === classId);
      if (!cls) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const enriched = data.map(n => {
        const dueDate = calcNodeDate(cls.startDate, n.offsetDays);
        const [dy, dm, dd] = dueDate.split('-').map(Number);
        const due = new Date(dy, dm - 1, dd);
        return { ...n, dueDate, daysUntil: Math.round((due.getTime() - today.getTime()) / 86400000) };
      });
      setNodes(enriched);
    } catch {
      setError('載入節點失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    setSelectedClassId(id || null);
    setNodes([]);
    if (id) loadNodes(id);
  };

  // [STEP] CRUD — 新增節點
  const handleAddNode = async () => {
    if (!selectedClassId || !nodeName.trim()) return;
    try {
      const res = await fetch(`/api/classes/${selectedClassId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClassId, name: nodeName.trim(), offsetDays, notes: nodeNotes || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNodeName('');
      setNodeNotes('');
      setOffsetDays(-7);
      loadNodes(selectedClassId);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // [STEP] CRUD — 刪除節點
  const handleDeleteNode = async (nodeId: number) => {
    if (!selectedClassId) return;
    try {
      await fetch(`/api/nodes/${nodeId}`, { method: 'DELETE' });
      loadNodes(selectedClassId);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // 套用模板
  const handleApplyTemplate = async () => {
    if (!selectedClassId || !selectedTemplateId) return;
    setApplyingTemplate(true);
    try {
      const res = await fetch(`/api/classes/${selectedClassId}/nodes/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      loadNodes(selectedClassId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApplyingTemplate(false);
    }
  };

  // 匯出 .ics
  const handleExportIcs = async () => {
    if (!selectedClassId || !selectedClass) return;
    const res = await fetch(`/api/classes/${selectedClassId}/nodes/ics`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedClass.className}-nodes.ics`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const getDaysLabel = (daysUntil: number) => {
    if (daysUntil < 0) return { text: `${Math.abs(daysUntil)} 天前`, cls: 'text-red-500' };
    if (daysUntil === 0) return { text: '今天', cls: 'text-red-600 font-semibold' };
    if (daysUntil <= 7) return { text: `${daysUntil} 天後`, cls: 'text-yellow-600' };
    return { text: `${daysUntil} 天後`, cls: 'text-green-600' };
  };

  // [STEP] RENDER
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-lg font-medium text-gray-800 mb-1">節點管控</h1>
        <p className="text-sm text-gray-500">管理班別流程里程碑節點</p>
      </div>

      {/* 選擇班別 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-gray-500 mb-1">選擇班別</label>
            <select
              value={selectedClassId ?? ''}
              onChange={handleClassChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="">-- 請選擇班別 --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.className} ({c.startDate})</option>
              ))}
            </select>
          </div>
          {selectedClassId && templates.length > 0 && (
            <div className="flex gap-2 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">套用模板</label>
                <select
                  value={selectedTemplateId ?? ''}
                  onChange={e => setSelectedTemplateId(Number(e.target.value) || null)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">-- 選擇模板 --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleApplyTemplate}
                disabled={!selectedTemplateId || applyingTemplate}
                className="px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
              >
                {applyingTemplate ? '套用中...' : '套用'}
              </button>
            </div>
          )}
          {selectedClassId && (
            <button
              onClick={handleExportIcs}
              className="px-3 py-2 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
            >
              📅 匯出 .ics
            </button>
          )}
        </div>
      </div>

      {/* 新增節點表單 */}
      {selectedClassId && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">新增節點</h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">節點名稱</label>
                <input
                  type="text"
                  value={nodeName}
                  onChange={e => setNodeName(e.target.value)}
                  placeholder="例：發送調訓函"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="w-40">
                <label className="block text-xs text-gray-500 mb-1">偏移天數（負 = 開訓前）</label>
                <input
                  type="number"
                  value={offsetDays}
                  onChange={e => setOffsetDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">備註（選填）</label>
                <input
                  type="text"
                  value={nodeNotes}
                  onChange={e => setNodeNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <button
              onClick={handleAddNode}
              disabled={!nodeName.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              新增節點
            </button>
          </div>
        </div>
      )}

      {/* 節點列表 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">節點列表</h2>
          {selectedClass && <span className="text-xs text-gray-400">{selectedClass.className}</span>}
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">載入中...</div>
        ) : !selectedClassId ? (
          <div className="p-8 text-center text-gray-400 text-sm">請先選擇班別</div>
        ) : nodes.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">尚無節點，請新增</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="px-4 py-2 text-left">節點名稱</th>
                  <th className="px-4 py-2 text-left">偏移天數</th>
                  <th className="px-4 py-2 text-left">實際日期</th>
                  <th className="px-4 py-2 text-left">距今</th>
                  <th className="px-4 py-2 text-left">備註</th>
                  <th className="px-4 py-2 text-left">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {nodes.map(node => {
                  const { text, cls } = getDaysLabel(node.daysUntil);
                  return (
                    <tr key={node.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-800">{node.name}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {node.offsetDays > 0 ? '+' : ''}{node.offsetDays} 天
                      </td>
                      <td className="px-4 py-2 text-gray-600">{node.dueDate}</td>
                      <td className={`px-4 py-2 text-xs ${cls}`}>{text}</td>
                      <td className="px-4 py-2 text-gray-400">{node.notes ?? '—'}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleDeleteNode(node.id)}
                          className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                        >
                          刪除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <p className="text-xs text-gray-400">
        💡 未來可支援從 CSV 範本批次匯入節點模板（本次保留介面空間）
      </p>
    </div>
  );
}
