'use client'
import { useCallback, useEffect, useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { api, type Item, type Stats } from './lib/api'
import AddItemModal from './components/AddItemModal'
import ItemCard from './components/ItemCard'

const STATUSES = [
  { value: '', label: 'すべて' },
  { value: 'unread', label: '未読' },
  { value: 'reading', label: '読書中' },
  { value: 'done', label: '完了' },
]

const CATEGORIES = [
  '技術', 'ビジネス', 'デザイン', 'サイエンス',
  'エンタメ', 'ライフスタイル', 'ニュース', 'その他',
]

// ---- ログイン画面 ----
function LoginPage() {
  const [loading, setLoading] = useState(false)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-md text-center">
        <div className="text-6xl mb-4">📚</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">WatchLater AI</h1>
        <p className="text-slate-500 mb-2 text-sm">
          URLや動画・PDF・スクショを投げ込むだけ。
        </p>
        <p className="text-slate-500 mb-8 text-sm">
          AIが自動でタイトル・要約・タグを生成して整理します。
        </p>
        <button
          onClick={() => { setLoading(true); signIn('google') }}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-6 bg-white border-2 border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all font-medium text-slate-700 disabled:opacity-60"
        >
          {/* Google ロゴ */}
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading ? 'リダイレクト中...' : 'Googleでログイン'}
        </button>
        <p className="text-xs text-slate-400 mt-6">
          ログインするとデータがアカウントに紐付けられ、<br />どのデバイスからでもアクセスできます。
        </p>
      </div>
    </div>
  )
}

// ---- メインアプリ ----
export default function Home() {
  const { data: session, status } = useSession()

  const [items, setItems] = useState<Item[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterTag, setFilterTag] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filterStatus) params.status = filterStatus
      if (filterCategory) params.category = filterCategory
      if (filterTag) params.tag = filterTag
      if (search) params.q = search

      const [itemsData, statsData, tagsData] = await Promise.all([
        api.getItems(params),
        api.getStats(),
        api.getTags(),
      ])
      setItems(itemsData)
      setStats(statsData)
      setTags(tagsData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterCategory, filterTag, search])

  useEffect(() => {
    if (session) fetchAll()
  }, [fetchAll, session])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const handleUpdated = (updated: Item) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    api.getStats().then(setStats)
  }

  const handleDeleted = (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    api.getStats().then(setStats)
  }

  // セッション読み込み中
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📚</div>
          <p className="text-slate-400 text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  // 未ログイン
  if (!session) {
    return <LoginPage />
  }

  // ログイン済み
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl">📚</span>
            <span className="font-bold text-slate-800 text-sm hidden sm:block">WatchLater AI</span>
          </div>

          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md">
            <div className="flex gap-2">
              <input
                type="search"
                placeholder="タイトル・要約・タグを検索..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 text-sm transition-colors"
              >
                検索
              </button>
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setSearchInput('') }}
                  className="px-3 py-1.5 text-slate-400 hover:text-slate-600 text-sm"
                >
                  ✕
                </button>
              )}
            </div>
          </form>

          <div className="flex-1" />

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
          >
            <span>＋</span>
            <span className="hidden sm:block">追加</span>
          </button>

          {/* ユーザーアバター + サインアウト */}
          <div className="flex items-center gap-2 shrink-0">
            {session.user?.image && (
              <img
                src={session.user.image}
                alt={session.user.name || ''}
                className="w-7 h-7 rounded-full border border-slate-200"
                title={session.user.name || session.user.email || ''}
              />
            )}
            <button
              onClick={() => signOut()}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors hidden sm:block"
            >
              サインアウト
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="space-y-4 sticky top-20">
            {/* Stats */}
            {stats && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">ステータス</p>
                {STATUSES.map(({ value, label }) => {
                  const count =
                    value === ''
                      ? stats.total
                      : value === 'unread'
                      ? stats.unread
                      : value === 'reading'
                      ? stats.reading
                      : stats.done
                  return (
                    <button
                      key={value}
                      onClick={() => setFilterStatus(value)}
                      className={`w-full flex justify-between items-center text-sm px-2 py-1 rounded-lg transition-colors ${
                        filterStatus === value
                          ? 'bg-brand-50 text-brand-700 font-medium'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{label}</span>
                      <span className="text-xs text-slate-400">{count}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Categories */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">カテゴリ</p>
              <button
                onClick={() => setFilterCategory('')}
                className={`w-full text-left text-sm px-2 py-1 rounded-lg transition-colors ${
                  filterCategory === '' ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                すべて
              </button>
              {CATEGORIES.filter((c) => stats?.by_category?.[c]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat === filterCategory ? '' : cat)}
                  className={`w-full flex justify-between items-center text-sm px-2 py-1 rounded-lg transition-colors ${
                    filterCategory === cat
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{cat}</span>
                  <span className="text-xs text-slate-400">{stats?.by_category?.[cat] ?? 0}</span>
                </button>
              ))}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">タグ</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.slice(0, 30).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setFilterTag(tag === filterTag ? '' : tag)}
                      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                        filterTag === tag
                          ? 'bg-brand-500 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Mobile filter bar */}
          <div className="flex gap-2 mb-4 lg:hidden overflow-x-auto pb-1">
            {STATUSES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterStatus(value)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors ${
                  filterStatus === value
                    ? 'bg-brand-500 text-white'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Active filters indicator */}
          {(filterCategory || filterTag || search) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {filterCategory && (
                <span className="text-xs bg-brand-50 text-brand-700 px-3 py-1 rounded-full flex items-center gap-1">
                  {filterCategory}
                  <button onClick={() => setFilterCategory('')} className="hover:text-brand-900">✕</button>
                </span>
              )}
              {filterTag && (
                <span className="text-xs bg-brand-50 text-brand-700 px-3 py-1 rounded-full flex items-center gap-1">
                  #{filterTag}
                  <button onClick={() => setFilterTag('')} className="hover:text-brand-900">✕</button>
                </span>
              )}
              {search && (
                <span className="text-xs bg-brand-50 text-brand-700 px-3 py-1 rounded-full flex items-center gap-1">
                  「{search}」
                  <button onClick={() => { setSearch(''); setSearchInput('') }} className="hover:text-brand-900">✕</button>
                </span>
              )}
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 h-52 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-5xl mb-4">📭</p>
              <p className="text-slate-600 font-medium mb-1">アイテムがありません</p>
              <p className="text-slate-400 text-sm mb-6">
                右上の「＋追加」からURLやテキストを投げ込んでください
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                最初のコンテンツを追加
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-3">{items.length} 件</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                  />
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {showModal && (
        <AddItemModal
          onClose={() => setShowModal(false)}
          onAdded={() => { fetchAll() }}
        />
      )}
    </div>
  )
}
