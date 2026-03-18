import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

interface TrainingClass {
  id: string; year_term: string; code: string; name: string;
  start_date: string; end_date: string; status: string; room: string; location: string;
}

const EMPTY: Partial<TrainingClass> = {
  year_term: '', code: '', name: '', start_date: '', end_date: '',
  status: 'planned', room: '', location: ''
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<TrainingClass[]>([])
  const [form, setForm] = useState<Partial<TrainingClass>>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () =>
    fetch('/api/classes')
      .then(r => r.json()).then(setClasses)
      .catch(() => setError('載入班別失敗'))

  useEffect(() => { load() }, [])

  const save = async () => {
    const method = editing ? 'PUT' : 'POST'
    const url = editing ? `/api/classes/${editing}` : '/api/classes'
    await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    }).catch(() => setError('儲存失敗'))
    setForm(EMPTY); setEditing(null); setShowForm(false); load()
  }

  const del = async (id: string) => {
    if (!confirm('確定刪除？')) return
    await fetch(`/api/classes/${id}`, { method: 'DELETE' })
      .catch(() => setError('刪除失敗'))
    load()
  }

  const edit = (cls: TrainingClass) => { setForm(cls); setEditing(cls.id); setShowForm(true) }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">班別管理</h1>
        <button onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true) }}
          className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">新增班別</button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {showForm && (
        <div className="bg-white border rounded p-4 grid grid-cols-2 gap-3 text-sm">
          {(['year_term','code','name','start_date','end_date','location','room','status'] as const).map(f => (
            <label key={f} className="flex flex-col gap-1">
              <span className="text-gray-600">{f}</span>
              <input className="border rounded px-2 py-1" value={(form as any)[f] ?? ''}
                onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))} />
            </label>
          ))}
          <div className="col-span-2 flex gap-2">
            <button onClick={save} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">儲存</button>
            <button onClick={() => setShowForm(false)} className="border px-3 py-1.5 rounded text-sm">取消</button>
          </div>
        </div>
      )}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">年度期別</th><th className="p-2 border">代號</th>
            <th className="p-2 border">名稱</th><th className="p-2 border">開始</th>
            <th className="p-2 border">結束</th><th className="p-2 border">狀態</th>
            <th className="p-2 border">操作</th>
          </tr>
        </thead>
        <tbody>
          {classes.map(cls => (
            <tr key={cls.id} className="hover:bg-gray-50">
              <td className="p-2 border">{cls.year_term}</td>
              <td className="p-2 border">{cls.code}</td>
              <td className="p-2 border">{cls.name}</td>
              <td className="p-2 border">{cls.start_date}</td>
              <td className="p-2 border">{cls.end_date}</td>
              <td className="p-2 border">{cls.status}</td>
              <td className="p-2 border flex gap-2">
                <button onClick={() => edit(cls)} className="text-blue-600 hover:underline">編輯</button>
                <button onClick={() => del(cls.id)} className="text-red-500 hover:underline">刪除</button>
                <Link to={`/classes/${cls.id}/nodes`} className="text-green-600 hover:underline">節點</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
