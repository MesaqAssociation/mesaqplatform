import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { Pool } from 'pg'
import PgAdapter from '@auth/pg-adapter'
import bcrypt from 'bcryptjs'

const databaseUrl = process.env.DATABASE_URL

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl?.includes('supabase.co')
    ? { rejectUnauthorized: false }
    : undefined,
})

const providers = [
  Credentials({
    name: 'Credentials',
    credentials: {
      phone: { label: 'Phone', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
    authorize: async (credentials) => {
      const phone = (credentials?.phone || '').trim()
      const password = credentials?.password || ''
      if (!/^0\d{9}$/.test(phone) || password.length < 8) {
        return null
      }

      const { rows } = await pool.query(
        'select id, name, email, image, phone, password_hash from "users" where phone = $1 limit 1',
        [phone]
      )
      const user = rows[0]
      if (!user || !user.password_hash) return null
      const ok = await bcrypt.compare(password, user.password_hash)
      if (!ok) return null
      return { id: user.id, name: user.name, email: user.email, image: user.image }
    },
  }),
] as any[]

export const {
  handlers,
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


