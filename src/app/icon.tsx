import { ImageResponse } from 'next/og'

export const size = {
    width: 32,
    height: 32,
}
export const contentType = 'image/png'
export const runtime = 'edge'

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                }}
            >
                <svg
                    width="32"
                    height="32"
                    viewBox="0 0 32 32"
                    fill="none"
                >
                    {/* Outer Ring */}
                    <circle cx="16" cy="16" r="13" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
                    {/* Iris */}
                    <circle cx="16" cy="16" r="5" stroke="#ef4444" strokeWidth="1.5" fill="none" />
                    {/* Pupil */}
                    <circle cx="16" cy="16" r="2.5" fill="#ef4444" />
                </svg>
            </div>
        ),
        {
            ...size,
        }
    )
}
