import { getServerSession } from 'next-auth'
import { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { NextResponse } from 'next/server'

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Operator',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null
                }

                const operatorEmail = process.env.OPERATOR_EMAIL
                const operatorPassword = process.env.OPERATOR_PASSWORD

                if (!operatorEmail || !operatorPassword) {
                    console.error('Operator credentials not configured')
                    return null
                }

                if (credentials.email !== operatorEmail) {
                    return null
                }

                if (credentials.password !== operatorPassword) {
                    return null
                }

                return {
                    id: '1',
                    email: operatorEmail,
                    name: 'Operator',
                }
            },
        }),
    ],
    session: {
        strategy: 'jwt',
        maxAge: 24 * 60 * 60,
    },
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.role = 'operator'
            }
            return token
        },
        async session({ session, token }) {
            return session
        },
    },
}

/**
 * Verify that the request is from an authenticated operator
 * Used in API routes to protect endpoints
 */
export async function requireAuth(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return new NextResponse(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
    }

    return null
}

/**
 * Check if a request is authenticated (returns session or null)
 */
export async function getAuth(req: Request) {
    return getServerSession(authOptions)
}
