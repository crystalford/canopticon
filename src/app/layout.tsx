import type { Metadata } from 'next'
import './globals.css'
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
    title: {
        default: 'CANOPTICON - Canadian Political Intelligence',
        template: '%s | CANOPTICON',
    },
    description: 'AI-powered analysis of Canadian Parliament, policy, and power. Automated monitoring. Investigative depth. Published at machine speed.',
    keywords: ['Canadian politics', 'Parliament', 'political intelligence', 'AI journalism', 'policy analysis'],
    authors: [{ name: 'CANOPTICON' }],
    openGraph: {
        type: 'website',
        siteName: 'CANOPTICON',
        title: 'CANOPTICON - Canadian Political Intelligence',
        description: 'AI-powered analysis of Canadian Parliament, policy, and power.',
    },
    twitter: {
        card: 'summary_large_image',
        site: '@canoptics',
        title: 'CANOPTICON',
        description: 'AI-powered Canadian political intelligence.',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className={cn("h-full dark", "font-sans", inter.variable)}>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
            </head>
            <body className="h-full antialiased font-sans">
                {children}
            </body>
        </html>
    )
}
