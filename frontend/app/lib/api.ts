import { getSession } from 'next-auth/react'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface Item {
  id: number
  url?: string
  title: string
  summary?: string
  thumbnail_url?: string
  source_type?: 'youtube' | 'url' | 'image' | 'pdf' | 'text'
  tags: string[]
  category: string
  priority: 'high' | 'medium' | 'low'
  status: 'unread' | 'reading' | 'done'
  read_time_minutes?: number
  created_at: string
  reminder_at?: string
}

export interface Stats {
  total: number
  unread: number
  reading: number
  done: number
  by_category: Record<string, number>
}

// 認証ヘッダーを取得（FormData送信時にも再利用できるよう export）
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession()
  if (session?.user?.email) {
    return { 'X-User-Id': session.user.email }
  }
  return {}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'エラーが発生しました')
  }
  return res.json()
}

export const api = {
  getItems: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request<Item[]>(`/items${qs ? `?${qs}` : ''}`)
  },
  createItem: (body: { url?: string; text?: string }) =>
    request<Item>('/items', { method: 'POST', body: JSON.stringify(body) }),
  updateItem: (id: number, body: { status?: string; title?: string }) =>
    request<Item>(`/items/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteItem: (id: number) =>
    request<{ ok: boolean }>(`/items/${id}`, { method: 'DELETE' }),
  getTags: () => request<string[]>('/tags'),
  getStats: () => request<Stats>('/stats'),
}
