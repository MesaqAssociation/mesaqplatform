import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'
import EmailProvider from 'next-auth/providers/nodemailer'
import { Pool } from 'pg'
import PgAdapter from '@auth/pg-adapter'

const databaseUrl = process.env.DATABASE_URL

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl?.includes('supabase.co')
    ? { rejectUnauthorized: false }
    : undefined,
})

const providers = [] as any[]

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  )
}

if (process.env.GOOGLE_ID && process.env.GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    })
  )
}

if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
  providers.push(
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    })
  )
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  adapter: PgAdapter(pool),
  session: {
    strategy: 'database',
  },
  providers,
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  // Expose a stable user id across sessions
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        ;(session.user as any).id = user.id
      }
      return session
    },
  },
})


