import type { Metadata } from 'next'
import { Syne, JetBrains_Mono, Libre_Baskerville } from 'next/font/google'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'CANOPTICON',
    template: '%s — CANOPTICON',
  },
  description: 'Canadian political intelligence. Mapping power.',
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${syne.variable} ${jetbrainsMono.variable} ${libreBaskerville.variable}`}
    >
      <body className="min-h-screen bg-void text-text-primary antialiased">
        {children}
      </body>
    </html>
  )
}
