import { useState } from 'react'

const TEMPLATE_HEADERS = 'year_term,code,name,category,training_type,start_date,end_date,days,location,room,capacity,status,notes'
const TEMPLATE_EXAMPLE = '115-1,A001,基層主管班,核心技能,實體,2026-04-01,2026-04-05,5,台北訓練中心,A101,30,planned,備註範例'

export default function ImportPage() {
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<{ valid: any[]; errors: any[] } | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const downloadTemplate = () => {
    const blob = new Blob([[TEMPLATE_HEADERS, TEMPLATE_EXAMPLE].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'import-template.csv'; a.click()
  }

  const previewCsv = async () => {
    setError(null)
    await fetch('/api/import/preview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText })
    })
      .then(r => r.json()).then(setPreview)
      .catch(() => setError('預覽失敗，請確認 CSV 格式'))
  }

  const confirmImport = async () => {
    if (!preview) return
    setError(null)
    await fetch('/api/import/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: preview.valid })
    })
      .then(r => r.json())
      .then(result => {
        setDone(`成功匯入 ${result.count} 筆班別`)
        setPreview(null); setCsvText('')
      })
      .catch(() => setError('匯入失敗'))
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">CSV 匯入</h1>
      <button onClick={downloadTemplate} className="border px-3 py-1.5 rounded text-sm">下載 CSV 範本</button>

      <textarea className="w-full border rounded p-2 text-sm font-mono h-40"
        placeholder="貼上 CSV 內容..." value={csvText}
        onChange={e => { setCsvText(e.target.value); setPreview(null) }} />

      <button onClick={previewCsv} disabled={!csvText}
        className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">預覽</button>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {preview && (
        <div className="space-y-2 text-sm">
          <p className="text-green-700">有效資料：{preview.valid.length} 筆</p>
          {preview.errors.length > 0 && (
            <ul className="text-red-600">
              {preview.errors.map((e: any, i: number) => <li key={i}>第 {e.row} 行：{e.message}</li>)}
            </ul>
          )}
          {preview.valid.length > 0 && (
            <button onClick={confirmImport} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">確認匯入</button>
          )}
        </div>
      )}

      {done && <p className="text-green-700 font-medium">{done}</p>}
    </div>
  )
}
