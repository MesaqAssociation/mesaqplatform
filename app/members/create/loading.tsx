import { Skeleton } from '@/components/ui/skeleton'

export default function CreateMemberLoading() {
  return (
    <div className="p-6">
      <Skeleton className="h-8 w-48 mb-6" />
      
      <div className="bg-card border border-border rounded-lg p-6 max-w-2xl">
        <div className="space-y-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}

