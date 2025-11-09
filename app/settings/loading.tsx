import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { MainLayout } from '@/components/Sidebar'

export default function SettingsLoading() {
  return (
    <MainLayout user={null}>
      <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold mb-4">Settings</h1>
      
      {/* Settings Sections */}
      <div className="space-y-4">
        {['Monthly Membership Fee', 'Language', 'Notification Preferences'].map((title, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">{title}</h2>
            <div className="space-y-3">
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-10 w-full max-w-sm" />
              <Button disabled className="mt-2">Save Changes</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
    </MainLayout>
  )
}

