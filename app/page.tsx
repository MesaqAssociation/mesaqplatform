"use client"

import Image from 'next/image'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Sign in to Mesaq</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center pb-2">
            <Image src="/placeholder-logo.svg" alt="Mesaq" width={48} height={48} />
          </div>

          <Button className="w-full" onClick={() => signIn('github', { callbackUrl: '/dashboard' })}>
            Continue with GitHub
          </Button>
          <Button variant="outline" className="w-full" onClick={() => signIn('google', { callbackUrl: '/dashboard' })}>
            Continue with Google
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => signIn('email', { callbackUrl: '/dashboard' })}>
            Continue with Email
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}


