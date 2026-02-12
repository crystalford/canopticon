import { ImageResponse } from 'next/og'

export const size = {
    width: 32,
    height: 32,
}
export const contentType = 'image/png'

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
                    {/* Metallic Ring */}
                    <circle cx="16" cy="16" r="14" stroke="#94a3b8" strokeWidth="2" />

                    {/* Red Eye Glow */}
                    <circle cx="16" cy="16" r="6" stroke="#ef4444" strokeWidth="2" />
                    <circle cx="16" cy="16" r="3" fill="#ef4444" />
                </svg>
            </div>
        ),
        {
            ...size,
        }
    )
}
