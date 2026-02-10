import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Privacy Policy | CANOPTICON',
    description: 'Privacy Policy for Canopticon.',
}

export default function PrivacyPage() {
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
                <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
                <p className="text-sm text-slate-500 mb-8">Last updated: February 8, 2026</p>

                <div className="prose prose-invert prose-lg max-w-none">
                    <h2>1. Introduction</h2>
                    <p>
                        Canopticon (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates the website canopticon.com (the &ldquo;Service&rdquo;). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website.
                    </p>

                    <h2>2. Information We Collect</h2>

                    <h3>Information Automatically Collected</h3>
                    <p>When you visit our website, we may automatically collect certain information, including:</p>
                    <ul>
                        <li>IP address</li>
                        <li>Browser type and version</li>
                        <li>Operating system</li>
                        <li>Referring URLs</li>
                        <li>Pages viewed and time spent on pages</li>
                        <li>Date and time of visits</li>
                    </ul>

                    <h3>Cookies and Similar Technologies</h3>
                    <p>
                        We may use cookies and similar tracking technologies to enhance your experience on our website. Cookies are small data files stored on your device. You can control cookie preferences through your browser settings.
                    </p>

                    <h3>Authentication Data</h3>
                    <p>
                        If you access the administrative dashboard, we collect login credentials (email and password) for authentication purposes. Passwords are securely hashed and never stored in plain text.
                    </p>

                    <h2>3. How We Use Your Information</h2>
                    <p>We use the information we collect to:</p>
                    <ul>
                        <li>Operate and maintain the Service</li>
                        <li>Improve and optimize the Service</li>
                        <li>Understand how visitors use the Service</li>
                        <li>Authenticate authorized users</li>
                        <li>Protect against unauthorized access or misuse</li>
                    </ul>

                    <h2>4. Third-Party Services</h2>
                    <p>We use the following third-party services that may collect or process data:</p>
                    <ul>
                        <li><strong>Vercel</strong> &mdash; Hosting and deployment platform</li>
                        <li><strong>Anthropic (Claude)</strong> &mdash; AI content generation</li>
                        <li><strong>Perplexity</strong> &mdash; Web search and research</li>
                        <li><strong>Unsplash</strong> &mdash; Stock photography</li>
                        <li><strong>OpenAI (DALL-E)</strong> &mdash; AI image generation</li>
                        <li><strong>X (Twitter)</strong> &mdash; Social media distribution</li>
                    </ul>
                    <p>
                        Each of these services has their own privacy policies governing their use of data. We encourage you to review their respective policies.
                    </p>

                    <h2>5. Data Storage and Security</h2>
                    <p>
                        Your data is stored on secure servers provided by our hosting provider. We implement reasonable technical and organizational measures to protect your information. However, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
                    </p>

                    <h2>6. Data Retention</h2>
                    <p>
                        We retain collected information for as long as necessary to provide the Service and fulfill the purposes outlined in this policy. Analytics data may be retained in aggregate form indefinitely.
                    </p>

                    <h2>7. Your Rights</h2>
                    <p>Depending on your jurisdiction, you may have the right to:</p>
                    <ul>
                        <li>Access the personal information we hold about you</li>
                        <li>Request correction of inaccurate information</li>
                        <li>Request deletion of your personal information</li>
                        <li>Object to or restrict processing of your information</li>
                        <li>Data portability</li>
                    </ul>
                    <p>
                        Canadian residents have rights under the Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable provincial privacy legislation.
                    </p>

                    <h2>8. Children&rsquo;s Privacy</h2>
                    <p>
                        The Service is not directed to individuals under the age of 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us.
                    </p>

                    <h2>9. International Data Transfers</h2>
                    <p>
                        Your information may be transferred to and processed in countries other than Canada, including the United States, where our third-party service providers operate. These countries may have different data protection laws than your jurisdiction.
                    </p>

                    <h2>10. Changes to This Policy</h2>
                    <p>
                        We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated &ldquo;Last updated&rdquo; date. Your continued use of the Service after changes constitutes acceptance of the updated policy.
                    </p>

                    <h2>11. Contact Us</h2>
                    <p>
                        If you have questions or concerns about this Privacy Policy or our data practices, please contact us at the information provided on our website.
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
