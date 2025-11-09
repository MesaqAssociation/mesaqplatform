import { Skeleton } from '@/components/ui/skeleton'
import { IconUsers, IconCash, IconCalendarEvent } from '@tabler/icons-react'
import { MainLayout } from '@/components/Sidebar'

export default function DashboardLoading() {
  return (
    <MainLayout user={null}>
      <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Members Card */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconUsers className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Members</h2>
            </div>
          </div>
          <div className="flex items-center justify-center mb-4">
            <Skeleton className="size-40 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-primary"></div>
                <span>Families</span>
              </div>
              <Skeleton className="h-4 w-8" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-muted"></div>
                <span>Total Members</span>
              </div>
              <Skeleton className="h-4 w-8" />
            </div>
          </div>
        </div>

        {/* Transactions Card */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconCash className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Recent Transactions</h2>
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-2 border-b border-border">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
            <div className="flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground">
              <span>See all</span>
              <span>→</span>
            </div>
          </div>
        </div>

        {/* Events Card */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-lg">
                <IconCalendarEvent className="size-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Upcoming Events</h2>
            </div>
            <span className="text-sm text-primary">View All</span>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-2 border-b border-border">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
    </MainLayout>
  )
}

