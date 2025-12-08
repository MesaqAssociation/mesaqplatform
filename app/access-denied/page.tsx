import { MainLayout } from '@/components/Sidebar'
import { getUserFromToken } from '@/lib/getUserFromToken'
import { IconLock, IconArrowLeft } from '@tabler/icons-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function AccessDeniedPage() {
  const user = await getUserFromToken()

  return (
    <MainLayout user={{ ...user, role: user?.role }}>
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-destructive/10 p-6 rounded-full">
              <IconLock className="size-16 text-destructive" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Access Denied</h1>
            <p className="text-muted-foreground">
              You don't have permission to access this page. This page is restricted to administrators and board members only.
            </p>
          </div>

          <div className="pt-4">
            <Link href="/dashboard">
              <Button className="gap-2">
                <IconArrowLeft className="size-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  )
}

