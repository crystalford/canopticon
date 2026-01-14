import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import type { AuthOptions } from 'next-auth'

/**
 * NextAuth configuration for single-operator authentication (Phase 1)
 */
const authOptions: AuthOptions = {
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

                // Single operator credentials from env
                const operatorEmail = process.env.OPERATOR_EMAIL
                const operatorPasswordHash = process.env.OPERATOR_PASSWORD_HASH

                if (!operatorEmail || !operatorPasswordHash) {
                    console.error('Operator credentials not configured')
                    return null
                }

                if (credentials.email !== operatorEmail) {
                    return null
                }

                const isValid = await bcrypt.compare(credentials.password, operatorPasswordHash)
                if (!isValid) {
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
        maxAge: 24 * 60 * 60, // 24 hours
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

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
