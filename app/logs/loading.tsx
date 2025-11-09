import { Skeleton } from '@/components/ui/skeleton'

export default function LogsLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-32 mb-4" />
      
      {/* Logs List */}
      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="divide-y">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="p-4 flex items-start gap-4">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

