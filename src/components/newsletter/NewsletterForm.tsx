'use client'

import { useState, FormEvent } from 'react'

interface NewsletterFormProps {
    source?: string
    className?: string
}

export function NewsletterForm({ source = 'homepage', className = '' }: NewsletterFormProps) {
    const [email, setEmail] = useState('')
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setStatus('loading')
        setMessage('')

        try {
            const response = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, source }),
            })

            const data = await response.json()

            if (response.ok) {
                setStatus('success')
                setMessage(data.message || 'Successfully subscribed!')
                setEmail('')
            } else {
                setStatus('error')
                setMessage(data.error || 'Something went wrong')
            }
        } catch {
            setStatus('error')
            setMessage('Failed to subscribe. Please try again.')
        }
    }

    return (
        <form onSubmit={handleSubmit} className={`flex flex-col sm:flex-row gap-3 ${className}`}>
            <div className="flex-1">
                <label htmlFor="newsletter-email" className="sr-only">
                    Email address
                </label>
                <input
                    id="newsletter-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="input w-full"
                    required
                    disabled={status === 'loading'}
                />
            </div>
            <button
                type="submit"
                disabled={status === 'loading'}
                className="btn-primary whitespace-nowrap"
            >
                {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
            </button>

            {message && (
                <p className={`text-sm mt-2 sm:mt-0 sm:ml-2 self-center ${status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                    {message}
                </p>
            )}
        </form>
    )
}

export function NewsletterSection() {
    return (
        <section className="bg-primary-50 dark:bg-primary-900/20 rounded-2xl p-8 text-center">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                Stay Informed
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6 max-w-md mx-auto">
                Get updates on significant political events delivered to your inbox. No spam, just signal.
            </p>
            <div className="max-w-md mx-auto">
                <NewsletterForm source="homepage" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
                You can unsubscribe at any time.
            </p>
        </section>
    )
}
