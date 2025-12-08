import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { MainLayout } from '@/components/Sidebar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function SettingsLoading() {
  return (
    <MainLayout user={null}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Settings</h1>
        
        <Tabs defaultValue="personal" className="max-w-4xl">
          <TabsList>
            <TabsTrigger value="personal">Personal Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-6 mt-6">
            <div className="border rounded-lg p-6">
              <Skeleton className="h-6 w-48 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-4 w-full max-w-md" />
                <Skeleton className="h-10 w-full max-w-sm" />
                <Skeleton className="h-10 w-32 mt-2" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}

