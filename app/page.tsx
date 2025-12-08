"use client"

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  // Check if user is already logged in
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/check', { method: 'GET' })
        if (res.ok) {
          // User is already logged in, redirect to dashboard
          router.push('/dashboard')
        }
      } catch (err) {
        // User is not logged in, proceed with login page
      } finally {
        setChecking(false)
      }
    }
    checkAuth()
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Invalid credentials')
      }
      router.push('/dashboard')
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking authentication
  if (checking) {
    return (
      <main className="min-h-dvh grid place-items-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh relative overflow-hidden bg-background">
      {/* Gallery Background - Simplified Grid */}
      <div className="absolute inset-0 -z-10">
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/85 to-background/90 z-10"></div>
        
        {/* Large Background Images */}
        <div className="absolute top-0 left-0 w-2/5 h-3/5 opacity-30">
          <img src="/gallery/mesaq1.webp" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute top-0 right-0 w-2/5 h-3/5 opacity-30">
          <img src="/gallery/mesaq3.webp" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute bottom-0 left-0 w-2/5 h-2/5 opacity-30">
          <img src="/gallery/mesaq8.webp" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute bottom-0 right-0 w-2/5 h-2/5 opacity-30">
          <img src="/gallery/mesaq10.webp" alt="" className="w-full h-full object-cover" />
        </div>
        
        {/* Medium Images */}
        <div className="absolute top-1/4 left-1/3 w-1/4 h-1/3 opacity-25 rounded-lg overflow-hidden">
          <img src="/gallery/mesaq5.webp" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute top-1/2 right-1/4 w-1/4 h-1/4 opacity-25 rounded-lg overflow-hidden">
          <img src="/gallery/mesaq7.webp" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute bottom-1/3 left-1/4 w-1/5 h-1/4 opacity-20 rounded-lg overflow-hidden">
          <img src="/gallery/mesaq11.webp" alt="" className="w-full h-full object-cover" />
        </div>
        
        {/* Small Accent Images */}
        <div className="absolute top-1/5 right-1/3 w-32 h-40 opacity-20 rounded-lg overflow-hidden">
          <img src="/gallery/mesaq2.webp" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute top-2/3 left-1/2 w-36 h-36 opacity-20 rounded-full overflow-hidden">
          <img src="/gallery/mesaq12.webp" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute bottom-1/4 right-1/3 w-32 h-32 opacity-20 rounded-lg overflow-hidden">
          <img src="/gallery/mesaq13.webp" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute top-1/3 left-1/6 w-28 h-36 opacity-15 rounded-lg overflow-hidden">
          <img src="/gallery/mesaq15.webp" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="absolute bottom-1/2 right-1/5 w-32 h-28 opacity-15 rounded-lg overflow-hidden">
          <img src="/gallery/mesaq17.webp" alt="" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Login Card - Centered with backdrop blur */}
      <div className="min-h-dvh grid place-items-center p-6 relative z-20">
        <Card className="w-full max-w-md backdrop-blur-sm bg-card/95 shadow-2xl border-2">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <Image src="/crop-logo.webp" alt="Mesaq" width={120} height={120} className="rounded-lg shadow-lg" />
            </div>
            <CardTitle className="text-center text-2xl">Sign in to Mesaq</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit} autoComplete="off">
              <div className="space-y-2">
                <Label htmlFor="identifier">Phone or Name</Label>
                <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="0456789012 or John Smith" required autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button className="w-full" type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}


