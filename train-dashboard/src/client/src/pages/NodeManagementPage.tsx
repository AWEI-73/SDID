import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

interface NodeItem {
  id: string; name: string; offset_days: number; notes: string; actual_date: string | null;
}

export default function NodeManagementPage() {
  const { classId } = useParams<{ classId: string }>()
  const [nodes, setNodes] = useState<NodeItem[]>([])
  const [form, setForm] = useState({ name: '', offset_days: 0, notes: '' })
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    fetch(`/api/classes/${classId}/nodes`)
      .then(r => r.json()).then(setNodes)
      .catch(() => setError('載入節點失敗'))
  }

  useEffect(() => { if (classId) load() }, [classId])

  const addNode = async () => {
    setError(null)
    await fetch(`/api/classes/${classId}/nodes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
      .catch(() => setError('新增節點失敗'))
    setForm({ name: '', offset_days: 0, notes: '' }); load()
  }

  const delNode = async (id: string) => {
    await fetch(`/api/nodes/${id}`, { method: 'DELETE' })
      .catch(() => setError('刪除節點失敗'))
    load()
  }

  const downloadIcs = () => {
    window.open(`/api/classes/${classId}/nodes/ics`)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link to="/classes" className="text-gray-500 hover:text-gray-700 text-sm">← 返回班別管理</Link>
          <h1 className="text-xl font-semibold">節點管控</h1>
        </div>
        <button onClick={downloadIcs} className="border px-3 py-1.5 rounded text-sm">匯出 .ics</button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-2 text-sm">
        <input className="border rounded px-2 py-1" placeholder="節點名稱"
          value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <input type="number" className="border rounded px-2 py-1 w-24" placeholder="偏移天數"
          value={form.offset_days} onChange={e => setForm(p => ({ ...p, offset_days: parseInt(e.target.value) }))} />
        <button onClick={addNode} disabled={!form.name}
          className="bg-blue-600 text-white px-3 py-1.5 rounded disabled:opacity-50">新增節點</button>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">節點名稱</th>
            <th className="p-2 border">偏移天數</th>
            <th className="p-2 border">實際日期</th>
            <th className="p-2 border">操作</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map(n => (
            <tr key={n.id} className="hover:bg-gray-50">
              <td className="p-2 border">{n.name}</td>
              <td className="p-2 border">{n.offset_days}</td>
              <td className="p-2 border">{n.actual_date ?? '-'}</td>
              <td className="p-2 border">
                <button onClick={() => delNode(n.id)} className="text-red-500 hover:underline">刪除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
