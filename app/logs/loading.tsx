import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'

export default function LogsLoading() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold mb-4">Activity Logs</h1>
      
      {/* Logs List */}
      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b">
          <Input placeholder="Search logs..." disabled className="opacity-50" />
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

