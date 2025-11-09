import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MainLayout } from '@/components/Sidebar'

export default function MemberDetailLoading() {
  return (
    <MainLayout user={null}>
      <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold mb-4">Member Details</h1>
      
      {/* Member Info Card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start gap-6">
          <Avatar className="size-24">
            <AvatarFallback>...</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
      </div>
      
      {/* Balance Card */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Balance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {['Current Balance', 'Expected Payments', 'Paid', 'Outstanding'].map((label, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
    </MainLayout>
  )
}

