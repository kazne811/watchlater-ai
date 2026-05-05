import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WatchLater AI — 後で見る整理アプリ',
  description: 'URLやテキストを投げ込むだけ。AIが自動で整理します。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
