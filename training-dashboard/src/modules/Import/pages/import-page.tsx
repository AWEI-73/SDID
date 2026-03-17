import React, { useState, useRef } from 'react';
import { downloadCsvTemplate } from '../services/download-csv-template';

/**
 * GEMS: ImportPage | P1 | ✓✓ | ()→JSX.Element | Story-2.3 | CSV 匯入頁面（含範本下載）
 * GEMS-FLOW: RENDER→DOWNLOAD
 * GEMS-DEPS: [importCSV, generateCsvTemplate]
 * GEMS-DEPS-RISK: MEDIUM
 */
// [STEP] RENDER — 顯示上傳區 + 下載按鈕
// [STEP] DOWNLOAD — 觸發 CSV 範本下載

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvText, setCsvText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // [STEP] UPLOAD
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);

      // [STEP] PREVIEW
      const lines = text.trim().split(/\r?\n/).slice(0, 6);
      const parsed = lines.map((l) => l.split(',').map((c) => c.trim()));
      setHeaders(parsed[0] ?? []);
      setPreview(parsed.slice(1));
    };
    reader.readAsText(file, 'utf-8');
  };

  // [STEP] CONFIRM
  const handleImport = async () => {
    if (!csvText) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body: csvText,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as ImportResult;
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFileName('');
    setPreview([]);
    setHeaders([]);
    setCsvText('');
    setResult(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-lg font-medium text-gray-800 mb-1">資料匯入</h1>
        <p className="text-sm text-gray-500">上傳 CSV 檔案批次匯入班別資料</p>
      </div>

      {/* [STEP] DOWNLOAD — CSV 範本下載 */}
      <div className="flex items-center gap-3">
        <button
          onClick={downloadCsvTemplate}
          className="px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
        >
          ⬇ 下載 CSV 範本
        </button>
        <span className="text-xs text-gray-400">請依範本格式填寫後上傳</span>
      </div>

      {/* 上傳區 */}
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          id="csv-upload"
        />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <div className="text-3xl mb-2">📥</div>
          <p className="text-sm text-gray-600">
            {fileName ? fileName : '點擊選擇 CSV 檔案'}
          </p>
          {!fileName && <p className="text-xs text-gray-400 mt-1">支援 UTF-8 編碼的 CSV 格式</p>}
        </label>
      </div>

      {/* 預覽表格 */}
      {headers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">預覽（前 5 行）</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 text-gray-600 whitespace-nowrap">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 操作按鈕 */}
      {csvText && !result && (
        <div className="flex gap-3">
          <button
            onClick={handleImport}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '匯入中...' : '確認匯入'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
        </div>
      )}

      {/* 錯誤訊息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 匯入結果 */}
      {result && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">匯入結果</h3>
          <div className="flex gap-6 text-sm">
            <span className="text-green-600">✓ 成功 {result.inserted} 筆</span>
            {result.skipped > 0 && <span className="text-yellow-600">⚠ 略過 {result.skipped} 筆</span>}
          </div>
          {result.errors.length > 0 && (
            <ul className="text-xs text-red-500 space-y-1">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          <button onClick={handleReset} className="text-sm text-blue-600 underline">重新匯入</button>
        </div>
      )}
    </div>
  );
}
