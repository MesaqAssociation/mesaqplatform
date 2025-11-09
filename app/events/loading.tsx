import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

export default function EventsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Button disabled>Create Event</Button>
      </div>
      
      {/* Event type tabs */}
      <div className="flex gap-2">
        <button disabled className="px-4 py-2 rounded text-sm font-medium bg-primary/10 opacity-50">
          All Events
        </button>
        <button disabled className="px-4 py-2 rounded text-sm font-medium bg-muted opacity-50">
          Meetings
        </button>
      </div>
      
      {/* Events grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4">
            <Skeleton className="h-5 w-3/4 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full mt-3" />
          </div>
        ))}
      </div>
    </div>
  )
}

