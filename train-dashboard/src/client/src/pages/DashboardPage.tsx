import { useEffect, useState } from 'react'

interface UpcomingNode {
  id: string; name: string; class_name: string; actual_date: string; days_until: number;
}
interface ClassItem {
  id: string; name: string; code: string; year_term: string;
  start_date: string; end_date: string; status: string;
  hasRoomConflict: boolean; hasDateConflict: boolean;
}

export default function DashboardPage() {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [upcoming, setUpcoming] = useState<UpcomingNode[]>([])
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'start_date' | 'year_term' | 'name' | 'status'>('start_date')
  const [error, setError] = useState<string | null>(null)

  const sorted = [...classes].sort((a, b) => a[sortBy].localeCompare(b[sortBy]))

  useEffect(() => {
    fetch(`/api/dashboard/classes?search=${search}`)
      .then(r => r.json()).then(setClasses)
      .catch(() => setError('載入班別失敗'))
    fetch('/api/dashboard/upcoming-nodes')
      .then(r => r.json()).then(setUpcoming)
      .catch(() => setError('載入待辦節點失敗'))
  }, [search])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {upcoming.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
          <h2 className="font-medium mb-2">近期待辦節點（7天內）</h2>
          <ul className="space-y-1 text-sm">
            {upcoming.map(n => (
              <li key={n.id} className="flex gap-3">
                <span className="text-gray-500">{n.actual_date}</span>
                <span>{n.class_name}</span>
                <span className="font-medium">{n.name}</span>
                <span className="text-blue-600">{n.days_until === 0 ? '今天' : `${n.days_until}天後`}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="flex gap-2 mb-3">
          <input
            className="border rounded px-3 py-1.5 text-sm w-64"
            placeholder="搜尋班別名稱或代號..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            className="border rounded px-3 py-1.5 text-sm"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="start_date">排序：開始日期</option>
            <option value="year_term">排序：年度期別</option>
            <option value="name">排序：班別名稱</option>
            <option value="status">排序：狀態</option>
          </select>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2 border">年度期別</th>
              <th className="p-2 border">班別代號</th>
              <th className="p-2 border">班別名稱</th>
              <th className="p-2 border">開始日期</th>
              <th className="p-2 border">結束日期</th>
              <th className="p-2 border">狀態</th>
              <th className="p-2 border">衝突</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(cls => (
              <tr key={cls.id} className="hover:bg-gray-50">
                <td className="p-2 border">{cls.year_term}</td>
                <td className="p-2 border">{cls.code}</td>
                <td className="p-2 border">{cls.name}</td>
                <td className="p-2 border">{cls.start_date}</td>
                <td className="p-2 border">{cls.end_date}</td>
                <td className="p-2 border">{cls.status}</td>
                <td className="p-2 border">
                  {cls.hasRoomConflict && <span className="text-red-500 mr-1">教室衝突</span>}
                  {cls.hasDateConflict && <span className="text-orange-500">時程重疊</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
