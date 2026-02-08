import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'CANOPTICON',
    description: 'AI-powered publishing system',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="h-full">
            <body className="h-full antialiased font-sans">
                {children}
            </body>
        </html>
    )
}
