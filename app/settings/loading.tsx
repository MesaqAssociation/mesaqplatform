import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-32 mb-4" />
      
      {/* Settings Sections */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-10 w-full max-w-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

