'use client'
import { useState } from 'react'
import { api, type Item } from '../lib/api'

const CATEGORY_COLORS: Record<string, string> = {
  技術: 'bg-blue-100 text-blue-700',
  ビジネス: 'bg-orange-100 text-orange-700',
  デザイン: 'bg-pink-100 text-pink-700',
  サイエンス: 'bg-emerald-100 text-emerald-700',
  エンタメ: 'bg-purple-100 text-purple-700',
  ライフスタイル: 'bg-teal-100 text-teal-700',
  ニュース: 'bg-red-100 text-red-700',
  その他: 'bg-slate-100 text-slate-600',
}

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
}

const STATUS_OPTIONS = [
  { value: 'unread', label: '未読', color: 'text-blue-600 bg-blue-50' },
  { value: 'reading', label: '読書中', color: 'text-amber-600 bg-amber-50' },
  { value: 'done', label: '完了', color: 'text-emerald-600 bg-emerald-50' },
]

const SOURCE_BADGE: Record<string, { label: string; icon: string; color: string }> = {
  youtube: { label: 'YouTube', icon: '▶', color: 'bg-red-50 text-red-500' },
  url:     { label: 'Web',     icon: '🌐', color: 'bg-slate-50 text-slate-500' },
  image:   { label: 'スクショ', icon: '🖼', color: 'bg-violet-50 text-violet-500' },
  pdf:     { label: 'PDF',     icon: '📄', color: 'bg-orange-50 text-orange-500' },
  text:    { label: 'テキスト', icon: '📝', color: 'bg-teal-50 text-teal-500' },
}

function getDomain(url?: string): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'たった今'
  if (mins < 60) return `${mins}分前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}日前`
  return `${Math.floor(days / 30)}ヶ月前`
}

interface Props {
  item: Item
  onUpdated: (item: Item) => void
  onDeleted: (id: number) => void
}

export default function ItemCard({ item, onUpdated, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false)
  const summaryLines = item.summary?.split('\n').filter(Boolean) ?? []
  const catColor = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS['その他']

  const cycleStatus = async () => {
    const order = ['unread', 'reading', 'done']
    const next = order[(order.indexOf(item.status) + 1) % order.length]
    const updated = await api.updateItem(item.id, { status: next })
    onUpdated(updated)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await api.deleteItem(item.id)
    onDeleted(item.id)
  }

  const statusInfo = STATUS_OPTIONS.find((s) => s.value === item.status)!

  const isYouTube = !!(item.thumbnail_url && item.url &&
    (item.url.includes('youtube.com') || item.url.includes('youtu.be')))

  // source_type がない古いアイテムのフォールバック
  const sourceType = item.source_type ?? (
    item.url
      ? (item.url.includes('youtube.com') || item.url.includes('youtu.be') ? 'youtube' : 'url')
      : 'text'
  )
  const sourceBadge = SOURCE_BADGE[sourceType] ?? SOURCE_BADGE['url']
  const domain = sourceType === 'url' ? getDomain(item.url) : null

  return (
    <div
      className={`group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col ${
        item.status === 'done' ? 'opacity-60' : ''
      }`}
    >
      {/* Top accent bar by priority */}
      <div className={`h-1 w-full ${PRIORITY_DOT[item.priority]}`} />

      {/* Thumbnail (YouTube etc.) */}
      {item.thumbnail_url && (
        <a
          href={item.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block w-full aspect-video overflow-hidden bg-slate-100"
        >
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          {isYouTube && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/60 rounded-full w-12 h-12 flex items-center justify-center hover:bg-red-600 transition-colors">
                <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </a>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header row */}
        <div className="flex items-start gap-2 flex-wrap">
          <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${catColor}`}>
            {item.category}
          </span>
          {/* 取り込み元バッジ */}
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${sourceBadge.color}`}>
            <span>{sourceBadge.icon}</span>
            <span>{domain ?? sourceBadge.label}</span>
          </span>
          <div className="flex-1" />
          <button
            onClick={cycleStatus}
            className={`shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full cursor-pointer transition-colors ${statusInfo.color}`}
          >
            {statusInfo.label}
          </button>
        </div>

        {/* Title */}
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-slate-800 hover:text-brand-600 line-clamp-2 leading-snug text-sm"
          >
            {item.title}
          </a>
        ) : (
          <p className="font-semibold text-slate-800 line-clamp-2 leading-snug text-sm">
            {item.title}
          </p>
        )}

        {/* Summary */}
        {summaryLines.length > 0 && (
          <ul className="space-y-1">
            {summaryLines.map((line, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-slate-500 leading-relaxed">
                <span className="shrink-0 text-slate-300 mt-0.5">▸</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 text-xs text-slate-400 mt-auto pt-2 border-t border-slate-50">
          <span>{timeAgo(item.created_at)}</span>
          {item.read_time_minutes && (
            <span>⏱ 約{item.read_time_minutes}分</span>
          )}
          {item.priority === 'high' && (
            <span className="text-red-400 font-medium">🔥 重要</span>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400"
            title="削除"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}
