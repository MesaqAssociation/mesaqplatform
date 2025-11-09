import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

export default function MembersLoading() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Members</h1>
        <Button disabled>Create New</Button>
      </div>
      
      <div className="overflow-auto">
        <table className="min-w-[800px] w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-3 px-2">Name</th>
              <th className="py-3 px-2">Email</th>
              <th className="py-3 px-2">Phone</th>
              <th className="py-3 px-2">Household Members</th>
              <th className="py-3 px-2">Role</th>
              <th className="py-3 px-2">Payment Status</th>
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

