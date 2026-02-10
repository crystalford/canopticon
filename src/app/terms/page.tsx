import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Terms of Service | CANOPTICON',
    description: 'Terms of Service for Canopticon.',
}

export default function TermsPage() {
    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-white/5">
                <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold text-white tracking-wider">
                        CANOPTICON
                    </Link>
                    <Link
                        href="/chat"
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Launch App
                    </Link>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
                <p className="text-sm text-slate-500 mb-8">Last updated: February 8, 2026</p>

                <div className="prose prose-invert prose-lg max-w-none">
                    <h2>1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using the Canopticon website at canopticon.com (the &ldquo;Service&rdquo;), operated by Canopticon (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
                    </p>

                    <h2>2. Description of Service</h2>
                    <p>
                        Canopticon is an AI-powered publishing platform focused on Canadian political intelligence and news analysis. The Service provides articles, analysis, and commentary generated with the assistance of artificial intelligence tools.
                    </p>

                    <h2>3. Content and Intellectual Property</h2>
                    <p>
                        All content published on Canopticon, including articles, analysis, images, and other materials, is owned by Canopticon unless otherwise stated. You may not reproduce, distribute, or create derivative works from our content without prior written permission.
                    </p>
                    <p>
                        Some images on this site are sourced from third-party providers including Unsplash and may be subject to their respective licenses. Attribution is provided where required.
                    </p>

                    <h2>4. AI-Generated Content</h2>
                    <p>
                        Content on this site may be generated or assisted by artificial intelligence. While we strive for accuracy, AI-generated content may contain errors or inaccuracies. We make reasonable efforts to review and verify content before publication, but we do not guarantee the accuracy, completeness, or timeliness of any information provided.
                    </p>

                    <h2>5. Use of the Service</h2>
                    <p>You agree not to:</p>
                    <ul>
                        <li>Use the Service for any unlawful purpose</li>
                        <li>Attempt to gain unauthorized access to any part of the Service</li>
                        <li>Interfere with or disrupt the Service or its infrastructure</li>
                        <li>Scrape, crawl, or use automated means to access the Service in a manner that exceeds reasonable use</li>
                    </ul>

                    <h2>6. Disclaimer of Warranties</h2>
                    <p>
                        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether express or implied. We do not warrant that the Service will be uninterrupted, secure, or error-free.
                    </p>

                    <h2>7. Limitation of Liability</h2>
                    <p>
                        To the fullest extent permitted by applicable law, Canopticon shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, or goodwill arising out of your use of the Service.
                    </p>

                    <h2>8. Third-Party Links and Services</h2>
                    <p>
                        The Service may contain links to third-party websites or services. We are not responsible for the content, privacy practices, or policies of any third-party sites or services.
                    </p>

                    <h2>9. Social Media Distribution</h2>
                    <p>
                        Content from Canopticon may be distributed via social media platforms including X (Twitter). By sharing our content, you agree to comply with the respective platform&rsquo;s terms of service.
                    </p>

                    <h2>10. Modifications to Terms</h2>
                    <p>
                        We reserve the right to modify these Terms of Service at any time. Changes will be effective immediately upon posting to the Service. Your continued use of the Service after changes constitutes acceptance of the modified terms.
                    </p>

                    <h2>11. Governing Law</h2>
                    <p>
                        These Terms shall be governed by and construed in accordance with the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict of law principles.
                    </p>

                    <h2>12. Contact</h2>
                    <p>
                        If you have questions about these Terms of Service, please contact us at the information provided on our website.
                    </p>
                </div>

                <div className="mt-12 pt-8 border-t border-white/5">
                    <Link
                        href="/"
                        className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        &larr; Back to home
                    </Link>
                </div>
            </main>
        </div>
    )
}
