import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { IconArrowUp, IconArrowDown } from '@tabler/icons-react'
import { MainLayout } from '@/components/Sidebar'

export default function FinanceLoading() {
  return (
    <MainLayout user={null}>
      <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Finance</h1>
        <Button disabled>Upload Statement</Button>
      </div>
      
      {/* Account tabs */}
      <div className="flex gap-2">
        {['Account 1', 'Account 2', 'Account 3'].map((name, i) => (
          <button
            key={i}
            disabled
            className="px-3 py-1.5 rounded text-xs font-medium bg-muted opacity-50"
          >
            {name}
          </button>
        ))}
      </div>
      
      {/* Transactions table */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Transactions</h2>
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border">
              <div className="flex items-center gap-2 flex-1">
                {i % 2 === 0 ? (
                  <IconArrowUp className="size-4 text-green-500 flex-shrink-0" />
                ) : (
                  <IconArrowDown className="size-4 text-red-500 flex-shrink-0" />
                )}
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
    </MainLayout>
  )
}

