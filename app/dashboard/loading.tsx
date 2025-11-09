import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-48" />
      
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-6 shadow-sm h-[480px]">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="size-12 rounded-lg" />
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="space-y-4 mt-8">
              <Skeleton className="h-40 w-40 rounded-full mx-auto" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

