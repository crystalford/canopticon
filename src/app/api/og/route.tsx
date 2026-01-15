import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)

        // ?title=<title>&date=<date>&readTime=<minutes>
        const title = searchParams.get('title')?.slice(0, 100) || 'Intelligence Briefing'
        const date = searchParams.get('date') || new Date().toLocaleDateString()
        const readTime = searchParams.get('readTime') || '5'

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        backgroundColor: '#0f172a', // Slate 900
                        backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.05) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(255,255,255,0.05) 2%, transparent 0%)',
                        backgroundSize: '100px 100px',
                        padding: '80px',
                        fontFamily: 'sans-serif',
                    }}
                >
                    {/* Header: Logo & Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '4px solid #6366f1' }} />
                            <div style={{ fontSize: 24, fontWeight: 900, color: 'white', letterSpacing: '4px' }}>
                                CANOPTICON
                            </div>
                        </div>
                        <div style={{
                            padding: '8px 16px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#94a3b8',
                            fontSize: 16,
                            letterSpacing: '2px',
                            textTransform: 'uppercase'
                        }}>
                            Intelligence Brief
                        </div>
                    </div>

                    {/* Main Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{
                            fontSize: 64,
                            fontWeight: 700,
                            color: 'white',
                            lineHeight: 1.1,
                            textWrap: 'balance',
                        }}>
                            {title}
                        </div>
                        <div style={{ width: '100px', height: '4px', backgroundColor: '#6366f1' }} />
                    </div>

                    {/* Footer: Metadata */}
                    <div style={{ display: 'flex', gap: '32px', color: '#94a3b8', fontSize: 20, fontFamily: 'monospace' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>PUBLISHED:</span>
                            <span style={{ color: 'white' }}>{date}</span>
                        </div>
                        <div style={{ width: '1px', height: '24px', backgroundColor: '#334155' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>READING TIME:</span>
                            <span style={{ color: 'white' }}>{readTime} MIN</span>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
            }
        )
    } catch (e: any) {
        console.log(`${e.message}`)
        return new Response(`Failed to generate the image`, {
            status: 500,
        })
    }
}
