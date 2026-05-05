'use client'
import { useRef, useState } from 'react'
import { api } from '../lib/api'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Props {
  onClose: () => void
  onAdded: () => void
}

type Tab = 'url' | 'text' | 'image' | 'pdf'

const TABS: { value: Tab; label: string }[] = [
  { value: 'url',   label: '🔗 URL' },
  { value: 'text',  label: '📝 テキスト' },
  { value: 'image', label: '🖼 スクショ' },
  { value: 'pdf',   label: '📄 PDF' },
]

export default function AddItemModal({ onClose, onAdded }: Props) {
  const [tab, setTab]         = useState<Tab>('url')
  const [url, setUrl]         = useState('')
  const [text, setText]       = useState('')
  const [file, setFile]       = useState<File | null>(null)       // 画像用
  const [pdfFile, setPdfFile] = useState<File | null>(null)       // PDF用
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const fileInputRef          = useRef<HTMLInputElement>(null)
  const pdfInputRef           = useRef<HTMLInputElement>(null)
  const dropRef               = useRef<HTMLDivElement>(null)

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) {
      setError('PNG / JPEG / GIF / WebP のみ対応しています')
      return
    }
    setFile(f)
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  const handlePdfFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf') {
      setError('PDFファイルのみ対応しています')
      return
    }
    setPdfFile(f)
    setError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (!f) return
    if (tab === 'pdf') handlePdfFile(f)
    else handleFile(f)
  }

  const submit = async () => {
    setError('')

    if (tab === 'url'   && !url.trim())   return setError('URLを入力してください')
    if (tab === 'text'  && !text.trim())  return setError('テキストを入力してください')
    if (tab === 'image' && !file)         return setError('画像を選択してください')
    if (tab === 'pdf'   && !pdfFile)      return setError('PDFを選択してください')

    setLoading(true)
    try {
      if (tab === 'image' && file) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch(`${BASE}/items/image`, { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(err.detail || 'エラーが発生しました')
        }
      } else if (tab === 'pdf' && pdfFile) {
        const formData = new FormData()
        formData.append('file', pdfFile)
        const res = await fetch(`${BASE}/items/pdf`, { method: 'POST', body: formData })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(err.detail || 'エラーが発生しました')
        }
      } else {
        await api.createItem(tab === 'url' ? { url: url.trim() } : { text: text.trim() })
      }
      onAdded()
      onClose()
    } catch (e: any) {
      setError(e.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const loadingMessage =
    tab === 'image' ? '画像をClaudeが読み取り中...' :
    tab === 'pdf'   ? 'PDFをClaudeが読み取り中（ページ数により30〜60秒）...' :
    tab === 'url'   ? 'URLをスクレイピング → AI分析中...' :
    'AI分析中...'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800">コンテンツを追加</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-5">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setTab(value); setError('') }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                tab === value
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* URL */}
        {tab === 'url' && (
          <input
            type="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            autoFocus
          />
        )}

        {/* Text */}
        {tab === 'text' && (
          <textarea
            placeholder="メモやコピーしたテキストをここに貼り付けてください..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            autoFocus
          />
        )}

        {/* Image */}
        {tab === 'image' && (
          <div>
            {/* Drop zone */}
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                preview ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
              }`}
            >
              {preview ? (
                <div className="relative">
                  <img
                    src={preview}
                    alt="preview"
                    className="max-h-52 mx-auto rounded-lg object-contain"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null) }}
                    className="absolute top-1 right-1 bg-white/80 hover:bg-white rounded-full w-6 h-6 text-slate-500 hover:text-red-500 text-xs flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="py-4">
                  <p className="text-3xl mb-2">🖼</p>
                  <p className="text-sm font-medium text-slate-600">クリックまたはドラッグ&ドロップ</p>
                  <p className="text-xs text-slate-400 mt-1">PNG / JPEG / GIF / WebP（最大10MB）</p>
                  <p className="text-xs text-slate-400 mt-0.5">スクリーンショットをそのまま貼り付けOK</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>

            {/* Paste hint */}
            <p className="text-xs text-center text-slate-400 mt-2">
              💡 Ctrl+V でクリップボードの画像を直接貼り付けもできます
            </p>

            {/* Clipboard paste support */}
            <PasteListener onFile={handleFile} />
          </div>
        )}

        {/* PDF */}
        {tab === 'pdf' && (
          <div>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => pdfInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                pdfFile ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-red-300 hover:bg-slate-50'
              }`}
            >
              {pdfFile ? (
                <div className="flex items-center justify-center gap-3 py-2">
                  <span className="text-4xl">📄</span>
                  <div className="text-left">
                    <p className="font-medium text-slate-700 text-sm">{pdfFile.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {(pdfFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPdfFile(null) }}
                    className="ml-auto text-slate-300 hover:text-red-400 text-lg"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="py-4">
                  <p className="text-3xl mb-2">📄</p>
                  <p className="text-sm font-medium text-slate-600">クリックまたはドラッグ&ドロップ</p>
                  <p className="text-xs text-slate-400 mt-1">PDFファイル（最大32MB）</p>
                  <p className="text-xs text-slate-400 mt-0.5">論文・資料・マニュアル・書籍サンプルなど</p>
                </div>
              )}
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfFile(f) }}
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[['📑', '論文・レポート'], ['📋', 'マニュアル'], ['📊', 'スライド資料']].map(([icon, label]) => (
                <div key={label} className="bg-slate-50 rounded-lg py-2 px-1">
                  <p className="text-lg">{icon}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        {/* Buttons */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                AI解析中...
              </>
            ) : '✨ AIで解析して保存'}
          </button>
        </div>

        {loading && (
          <p className="mt-3 text-xs text-center text-slate-400">{loadingMessage}（10〜20秒）</p>
        )}
      </div>
    </div>
  )
}

// クリップボードからの貼り付けをハンドルするコンポーネント
function PasteListener({ onFile }: { onFile: (f: File) => void }) {
  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) onFile(f)
        break
      }
    }
  }

  // グローバルにペーストイベントを受け取る
  useState(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  })

  return null
}
