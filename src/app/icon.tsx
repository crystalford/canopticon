import { ImageResponse } from 'next/og'

export const runtime = 'edge'

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
                    fontSize: 24,
                    background: 'black',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    border: '2px solid #334155', // slate-700
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Red gradients mimicked with radial gradients in style strings support is limited in OG generation but basic divs work */}
                <div
                    style={{
                        position: 'absolute',
                        inset: '2px', // inset-1
                        background: 'linear-gradient(135deg, #dc2626, #7f1d1d)', // red-600 to red-900
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {/* Inner pupil */}
                    <div
                        style={{
                            width: '12px',
                            height: '12px',
                            background: 'black',
                            borderRadius: '50%',
                            boxShadow: '0 0 4px #000',
                        }}
                    />
                    {/* Glare */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '4px',
                            left: '6px',
                            width: '4px',
                            height: '4px',
                            background: 'rgba(255,255,255,0.6)',
                            borderRadius: '50%',
                        }}
                    />
                </div>
            </div>
        ),
        {
            ...size,
        }
    )
}
