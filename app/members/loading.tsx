import { Skeleton } from '@/components/ui/skeleton'

export default function MembersLoading() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      
      <div className="overflow-auto">
        <table className="min-w-[800px] w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-3 px-2"><Skeleton className="h-4 w-16" /></th>
              <th className="py-3 px-2"><Skeleton className="h-4 w-16" /></th>
              <th className="py-3 px-2"><Skeleton className="h-4 w-16" /></th>
              <th className="py-3 px-2"><Skeleton className="h-4 w-24" /></th>
              <th className="py-3 px-2"><Skeleton className="h-4 w-16" /></th>
              <th className="py-3 px-2"><Skeleton className="h-4 w-24" /></th>
            </tr>
          </thead>
          <tbody>
            {[...Array(10)].map((_, i) => (
              <tr key={i} className="border-t">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </td>
                <td className="py-3 px-2"><Skeleton className="h-4 w-40" /></td>
                <td className="py-3 px-2"><Skeleton className="h-4 w-28" /></td>
                <td className="py-3 px-2"><Skeleton className="h-4 w-8" /></td>
                <td className="py-3 px-2"><Skeleton className="h-6 w-24 rounded-full" /></td>
                <td className="py-3 px-2"><Skeleton className="h-6 w-20 rounded-full" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

